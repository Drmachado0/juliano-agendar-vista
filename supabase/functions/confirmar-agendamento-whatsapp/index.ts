import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { gerarMensagemDoTemplate, formatarData, formatarHora } from "../_shared/templateRenderer.ts";
import { envioAutomaticoLiberado } from "../_shared/envioStatusGlobal.ts";
import { isBotPaused, isKnownInvalidWhatsapp } from "../_shared/whatsappGuards.ts";
import { podeEnviarOutbound, LIMITES_PADRAO } from "../_shared/rateLimitOutbound.ts";
import { assertNomePacienteValido } from "../_shared/sanitizeOptionalFields.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchemaById = z.object({
  agendamento_id: z.string().uuid(),
});

const agendamentoDataSchema = z.object({
  nome_completo: z.string().min(1),
  telefone_whatsapp: z.string().min(10),
  tipo_atendimento: z.string().optional(),
  local_atendimento: z.string().min(1),
  data_agendamento: z.string().min(1),
  hora_agendamento: z.string().min(1),
  convenio: z.string().optional(),
  data_nascimento: z.string().optional().nullable(),
});

const requestSchemaByData = z.object({
  agendamento_data: agendamentoDataSchema,
});

function formatarTelefone(telefone: string): string {
  const apenasNumeros = telefone.replace(/\D/g, '');
  if (apenasNumeros.startsWith('55')) return apenasNumeros;
  return '55' + apenasNumeros;
}

function primeiroNome(nome: string): string {
  return (nome || '').trim().split(/\s+/)[0] || '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log('[ConfirmarWhatsApp] Recebido pedido:', JSON.stringify(body));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let agendamentoData: any;
    let agendamentoId: string | null = null;

    const byDataResult = requestSchemaByData.safeParse(body);
    if (byDataResult.success) {
      agendamentoData = {
        ...byDataResult.data.agendamento_data,
        aceita_contato_whatsapp_email: true,
      };
    } else {
      const byIdResult = requestSchemaById.safeParse(body);
      if (!byIdResult.success) {
        return new Response(
          JSON.stringify({ success: false, error: 'Dados inválidos: forneça agendamento_id ou agendamento_data' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      agendamentoId = byIdResult.data.agendamento_id;
      const { data: agendamento, error: fetchError } = await supabase
        .from('agendamentos').select('*').eq('id', agendamentoId).single();
      if (fetchError || !agendamento) {
        return new Response(
          JSON.stringify({ success: false, error: 'Agendamento não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      agendamentoData = agendamento;
    }

    if (agendamentoId && agendamentoData.aceita_contato_whatsapp_email === false) {
      return new Response(
        JSON.stringify({ success: true, message: 'Paciente não aceita contato por WhatsApp', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Guard nome inválido/placeholder: NUNCA gerar/disparar "Paciente: undefined".
    // Escala para humano marcando o agendamento (se houver id) e devolve erro monitorável.
    const nomeCheck = assertNomePacienteValido(agendamentoData?.nome_completo);
    if (!nomeCheck.ok) {
      console.error("[ConfirmarWhatsApp] BLOQUEADO nome_paciente_invalido", {
        motivo: nomeCheck.motivo,
        agendamento_id: agendamentoId,
        raw: agendamentoData?.nome_completo,
      });
      if (agendamentoId) {
        // Escala para humano: pausa bot por 24h e marca status de confirmação
        const pausaAte = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await supabase.from("agendamentos").update({
          confirmation_status: "bloqueado_nome_invalido",
          confirmation_sent_at: new Date().toISOString(),
          bot_pausado_ate: pausaAte,
          bot_pausa_motivo: `nome_paciente_invalido:${nomeCheck.motivo}`,
        }).eq("id", agendamentoId).then(() => {}, () => {});
        // registra em system_logs para alerta/monitoramento
        await supabase.from("system_logs").insert({
          nivel: "error",
          origem: "confirmar-agendamento-whatsapp",
          mensagem: "confirmacao_bloqueada_nome_invalido",
          contexto: {
            agendamento_id: agendamentoId,
            motivo: nomeCheck.motivo,
            nome_raw: agendamentoData?.nome_completo ?? null,
          },
        }).then(() => {}, () => {});
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: "Nome do paciente inválido — confirmação não enviada. Escalado para humano.",
          code: "nome_paciente_invalido",
          motivo: nomeCheck.motivo,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    agendamentoData.nome_completo = nomeCheck.nome!;


    // ===== Guards (mantidos) =====
    const liberado = await envioAutomaticoLiberado(supabase);
    if (!liberado.liberado) {
      console.log('[ConfirmarWhatsApp] Envios bloqueados:', liberado.motivo);
      return new Response(
        JSON.stringify({ success: true, skipped: true, motivo: liberado.motivo }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (agendamentoId && isBotPaused(agendamentoData)) {
      console.log('[ConfirmarWhatsApp] Bot pausado para esse agendamento');
      return new Response(
        JSON.stringify({ success: true, skipped: true, motivo: 'bot_pausado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const telefoneFormatado = formatarTelefone(agendamentoData.telefone_whatsapp);

    if (await isKnownInvalidWhatsapp(supabase, telefoneFormatado)) {
      console.log('[ConfirmarWhatsApp] Número marcado como sem WhatsApp');
      return new Response(
        JSON.stringify({ success: true, skipped: true, motivo: 'sem_whatsapp' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rate = await podeEnviarOutbound(supabase, telefoneFormatado, [
      LIMITES_PADRAO.confirmacao,
      LIMITES_PADRAO.global_burst,
    ]);
    if (!rate.ok) {
      console.log('[ConfirmarWhatsApp] Rate limit:', rate.motivo);
      return new Response(
        JSON.stringify({ success: true, skipped: true, motivo: rate.motivo }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== Render do template (mantido) =====
    const dataFmt = formatarData(agendamentoData.data_agendamento);
    const horaFmt = formatarHora(agendamentoData.hora_agendamento);
    const linkStatus = agendamentoId ? `https://drjulianomachado.com/status/${agendamentoId}` : undefined;

    const mensagem = await gerarMensagemDoTemplate('confirmacao_agendamento', {
      nome: agendamentoData.nome_completo,
      data: dataFmt,
      hora: horaFmt,
      local: agendamentoData.local_atendimento,
      tipo_atendimento: agendamentoData.tipo_atendimento,
      link_status: linkStatus,
    });

    // ===== Envio via n8n (ManyChat) =====
    const webhookUrl = Deno.env.get('N8N_WEBHOOK_CONFIRMACAO');
    if (!webhookUrl) {
      console.error('[ConfirmarWhatsApp] N8N_WEBHOOK_CONFIRMACAO não configurado');
      if (agendamentoId) {
        await supabase.from('agendamentos').update({
          confirmation_status: 'falha_envio',
          confirmation_sent_at: new Date().toISOString(),
        }).eq('id', agendamentoId);
      }
      return new Response(
        JSON.stringify({ success: false, error: 'Webhook n8n não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nascimentoFmt = agendamentoData.data_nascimento
      ? formatarData(agendamentoData.data_nascimento)
      : '';

    const payload = {
      event_id: `${agendamentoId ?? 'sem_id'}:confirmacao_imediata`,
      agendamento_id: agendamentoId,
      telefone: telefoneFormatado,
      nome: agendamentoData.nome_completo,
      primeiro_nome: primeiroNome(agendamentoData.nome_completo),
      data: dataFmt,
      hora: horaFmt,
      local: agendamentoData.local_atendimento,
      tipo: agendamentoData.tipo_atendimento ?? '',
      convenio: agendamentoData.convenio ?? '',
      nascimento: nascimentoFmt,
      link_status: linkStatus ?? '',
      mensagem,
    };

    console.log('[ConfirmarWhatsApp] POST → n8n', payload.event_id);

    let n8nOk = false;
    let n8nStatus = 0;
    let n8nBody = '';
    try {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      n8nStatus = resp.status;
      n8nBody = await resp.text().catch(() => '');
      n8nOk = resp.ok;
    } catch (e) {
      console.error('[ConfirmarWhatsApp] Erro POST n8n:', e);
    }

    if (!n8nOk) {
      console.error('[ConfirmarWhatsApp] n8n falhou:', n8nStatus, n8nBody);
      if (agendamentoId) {
        await supabase.from('agendamentos').update({
          confirmation_status: 'falha_envio',
          confirmation_sent_at: new Date().toISOString(),
        }).eq('id', agendamentoId);
      }
      return new Response(
        JSON.stringify({ success: false, error: `n8n retornou ${n8nStatus}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sucesso no POST: NÃO marca como enviado — n8n confirma via n8n-registrar-envio.
    console.log('[ConfirmarWhatsApp] ✅ Disparado para n8n (aguardando callback)');
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Disparado para n8n; aguardando callback de envio',
        telefone: telefoneFormatado,
        event_id: payload.event_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ConfirmarWhatsApp] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
