// Edge Function: Enviar Confirmação WhatsApp Automática
// Executa via cron a cada 15 minutos para enviar confirmações 24h antes do agendamento

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  sendWhatsappTextMessage, 
  buildAppointmentConfirmationMessage,
  normalizePhoneNumber,
  sanitizePayload,
} from '../_shared/evolutionApiClient.ts';
import { isBotPaused, isKnownInvalidWhatsapp } from '../_shared/whatsappGuards.ts';
import { podeEnviarOutbound, LIMITES_PADRAO, logarBloqueioRateLimit } from '../_shared/rateLimitOutbound.ts';
import { envioAutomaticoLiberado } from '../_shared/envioStatusGlobal.ts';
import { requireCronSecret, unauthorizedResponse } from '../_shared/authGuards.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuração: horas de antecedência para enviar confirmação
const CONFIRMATION_HOURS_BEFORE = 24;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar token de cron via Vault (timing-safe). Aceita x-cron-secret ou Authorization: Bearer.
    const cronGuard = await requireCronSecret(req);
    if (!cronGuard.ok) {
      console.warn('[Confirmação] Token de cron inválido/ausente:', cronGuard.reason);
      return unauthorizedResponse(cronGuard.reason ?? 'unauthorized', corsHeaders);
    }



    console.log('[Confirmação] Iniciando job de confirmações automáticas...');

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const killSwitch = await envioAutomaticoLiberado(supabase);
    if (!killSwitch.liberado) {
      console.warn(`[Confirmação] 🛑 Bloqueado pelo kill switch: ${killSwitch.motivo}`);
      return new Response(
        JSON.stringify({ blocked: true, reason: killSwitch.motivo }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calcular janela de tempo: agendamentos entre agora e 24h no futuro
    const now = new Date();
    const futureLimit = new Date(now.getTime() + CONFIRMATION_HOURS_BEFORE * 60 * 60 * 1000);
    
    const todayDate = now.toISOString().split('T')[0];
    const futureLimitDate = futureLimit.toISOString().split('T')[0];

    console.log(`[Confirmação] Buscando agendamentos entre ${todayDate} e ${futureLimitDate}`);

    // Buscar agendamentos pendentes de confirmação
    const { data: agendamentos, error: fetchError } = await supabase
      .from('agendamentos')
      .select('*')
      .in('confirmation_status', ['nao_enviado', 'falha_envio'])
      .gte('data_agendamento', todayDate)
      .lte('data_agendamento', futureLimitDate)
      .not('telefone_whatsapp', 'is', null)
      .order('data_agendamento', { ascending: true });

    if (fetchError) {
      console.error('[Confirmação] Erro ao buscar agendamentos:', fetchError);
      throw fetchError;
    }

    if (!agendamentos || agendamentos.length === 0) {
      console.log('[Confirmação] Nenhum agendamento pendente de confirmação');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum agendamento pendente',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Confirmação] Encontrados ${agendamentos.length} agendamentos para processar`);

    let successCount = 0;
    let errorCount = 0;

    // Processar cada agendamento
    for (const agendamento of agendamentos) {
      try {
        // Verificar se o agendamento está dentro da janela de tempo
        const agendamentoDateTime = new Date(
          `${agendamento.data_agendamento}T${agendamento.hora_agendamento}`
        );
        
        // Só enviar se faltar até 24h (e mais de 1h para não enviar muito em cima)
        const hoursUntilAppointment = (agendamentoDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        if (hoursUntilAppointment > CONFIRMATION_HOURS_BEFORE || hoursUntilAppointment < 1) {
          console.log(`[Confirmação] Agendamento ${agendamento.id} fora da janela (${hoursUntilAppointment.toFixed(1)}h)`);
          continue;
        }

        // GUARD #4: bot pausado
        if (isBotPaused(agendamento)) {
          console.log(`[Confirmação] Agendamento ${agendamento.id} com bot pausado — pulando`);
          continue;
        }

        // GUARD #1: número conhecido como sem WhatsApp
        if (await isKnownInvalidWhatsapp(supabase, agendamento.telefone_whatsapp)) {
          console.warn(`[Confirmação] ${agendamento.id} sem WhatsApp (cache) — marcando falha`);
          await supabase
            .from('agendamentos')
            .update({
              confirmation_status: 'falha_envio',
              confirmation_sent_at: new Date().toISOString(),
            })
            .eq('id', agendamento.id);
          errorCount++;
          continue;
        }

        console.log(`[Confirmação] Processando agendamento ${agendamento.id} - ${agendamento.nome_completo}`);

        // Montar mensagem de confirmação
        const message = buildAppointmentConfirmationMessage(
          agendamento.nome_completo,
          agendamento.data_agendamento,
          agendamento.hora_agendamento,
          agendamento.local_atendimento
        );

        // Rate-limit anti-loop
        const rl = await podeEnviarOutbound(supabase, agendamento.telefone_whatsapp, [LIMITES_PADRAO.confirmacao]);
        if (!rl.ok) {
          console.warn(`[Confirmação] 🚫 Rate limit ${agendamento.id}: ${rl.motivo}`);
          await logarBloqueioRateLimit(supabase, 'enviar-confirmacao-whatsapp', agendamento.telefone_whatsapp, agendamento.id, rl);
          continue;
        }

        // Enviar mensagem via Evolution API
        const result = await sendWhatsappTextMessage(agendamento.telefone_whatsapp, message);

        // Item #5: persistir sanitizedResponse (sem token/apikey)
        const logData: Record<string, unknown> = {
          agendamento_id: agendamento.id,
          telefone: normalizePhoneNumber(agendamento.telefone_whatsapp),
          direcao: 'OUT',
          conteudo: message,
          tipo_mensagem: 'confirmacao_automatica',
          status_envio: result.success ? (result.deliveryStatus ?? 'enviado') : 'erro',
          mensagem_externa_id: result.messageId || null,
          payload: sanitizePayload({
            evolution_status: result.evolutionStatus ?? null,
            response: result.sanitizedResponse ?? null,
          }) as any,
          error_message: result.errorMessage || null,
        };

        await supabase.from('mensagens_whatsapp').insert(logData);


        // Atualizar status do agendamento
        const updateData: Record<string, unknown> = {
          confirmation_sent_at: new Date().toISOString(),
          confirmation_channel: 'whatsapp',
        };

        if (result.success) {
          updateData.confirmation_status = 'aguardando_confirmacao';
          successCount++;
          console.log(`[Confirmação] ✓ Enviado para ${agendamento.nome_completo}`);
        } else {
          updateData.confirmation_status = 'falha_envio';
          errorCount++;
          console.error(`[Confirmação] ✗ Falha para ${agendamento.nome_completo}: ${result.errorMessage}`);
        }

        await supabase
          .from('agendamentos')
          .update(updateData)
          .eq('id', agendamento.id);

      } catch (agendamentoError) {
        console.error(`[Confirmação] Erro ao processar agendamento ${agendamento.id}:`, agendamentoError);
        errorCount++;
        
        // Registrar falha
        await supabase
          .from('agendamentos')
          .update({ 
            confirmation_status: 'falha_envio',
            confirmation_sent_at: new Date().toISOString(),
          })
          .eq('id', agendamento.id);
      }
    }

    console.log(`[Confirmação] Job finalizado: ${successCount} sucesso, ${errorCount} erros`);

    return new Response(JSON.stringify({ 
      success: true,
      processed: agendamentos.length,
      successCount,
      errorCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Confirmação] Erro geral:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
