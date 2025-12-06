// Edge Function: Enviar Confirmação WhatsApp Automática
// Executa via cron a cada 15 minutos para enviar confirmações 24h antes do agendamento

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  sendWhatsappTextMessage, 
  buildAppointmentConfirmationMessage,
  normalizePhoneNumber 
} from '../_shared/evolutionApiClient.ts';

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
    // Validar token de cron - OBRIGATÓRIO quando CRON_SECRET está configurado
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    
    if (cronSecret) {
      const expectedAuth = `Bearer ${cronSecret}`;
      if (!authHeader || authHeader !== expectedAuth) {
        console.warn('[Confirmação] Token de cron inválido ou ausente');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log('[Confirmação] Iniciando job de confirmações automáticas...');

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

        console.log(`[Confirmação] Processando agendamento ${agendamento.id} - ${agendamento.nome_completo}`);

        // Montar mensagem de confirmação
        const message = buildAppointmentConfirmationMessage(
          agendamento.nome_completo,
          agendamento.data_agendamento,
          agendamento.hora_agendamento,
          agendamento.local_atendimento
        );

        // Enviar mensagem via Evolution API
        const result = await sendWhatsappTextMessage(agendamento.telefone_whatsapp, message);

        // Registrar log na tabela mensagens_whatsapp
        const logData: Record<string, unknown> = {
          agendamento_id: agendamento.id,
          telefone: normalizePhoneNumber(agendamento.telefone_whatsapp),
          direcao: 'OUT',
          conteudo: message,
          tipo_mensagem: 'confirmacao_automatica',
          status_envio: result.success ? 'enviado' : 'erro',
          mensagem_externa_id: result.messageId || null,
          payload: result.rawResponse || null,
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
