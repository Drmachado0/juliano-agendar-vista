// ============================================================================
// confirmar-agendamento
//
// Fecha o funil: valida que o horário continua livre E confirma o card na
// MESMA chamada. Hoje isso são duas chamadas MCP separadas do agente
// (validar_horario → criar_agendamento); entre uma e outra o paciente leva
// alguns segundos para responder "sim" e outra pessoa pode pegar o horário.
// Juntando as duas no servidor, essa janela deixa de existir.
//
// Camada HTTP fina — a regra fail-closed inteira vive em
// _shared/agenda.ts::criarAgendamentoValidado.
//
// O corpo aceita APENAS {telefone_whatsapp, agendamento_id}. Nome,
// nascimento, convênio, tipo, unidade, data e horário são lidos do próprio
// card: quem chama não escolhe nenhum desses valores.
//
// Efeitos colaterais: grava no banco e dispara notificar-n8n
// (evento agendamento_criado → CRM / e-mail da clínica / Google Calendar).
// NÃO envia WhatsApp — quem envia é o n8n, usando mensagem_pronta. Mandar
// aqui também faria o paciente receber a confirmação duas vezes.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireN8nSecret, unauthorizedResponse, requestId } from "../_shared/authGuards.ts";
import { maskTelefone } from "../_shared/telefoneCanonico.ts";
import { criarAgendamentoValidado } from "../_shared/agenda.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = await requireN8nSecret(req);
  if (!guard.ok) return unauthorizedResponse(guard.reason ?? "unauthorized", corsHeaders);
  const rid = requestId(req);

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const r = await criarAgendamentoValidado(supabase, {
      agendamento_id: body?.agendamento_id ?? null,
      telefone_whatsapp: body?.telefone_whatsapp ?? null,
    });

    if (!r.sucesso) {
      console.warn(
        `[confirmar-agendamento ${rid}] recusado motivo=${r.motivo} ` +
          `detalhe=${r.detalhe ?? "-"} tel=${maskTelefone(body?.telefone_whatsapp)}`,
      );
      return json({
        sucesso: false,
        motivo: r.motivo,
        ...(r.detalhe ? { detalhe: r.detalhe } : {}),
        mensagem_pronta: null,
        request_id: rid,
      });
    }

    console.log(
      `[confirmar-agendamento ${rid}] confirmado id=${r.agendamento_id} ` +
        `tel=${maskTelefone(body?.telefone_whatsapp)}`,
    );

    // Notificação do CRM. Aguardada para reportar ao chamador, mas NUNCA
    // derruba a confirmação: o agendamento já está gravado neste ponto.
    let notificacoes_ok = true;
    try {
      const { error } = await supabase.functions.invoke("notificar-n8n", {
        body: { evento: "agendamento_criado", dados_agendamento: r.dados },
      });
      if (error) notificacoes_ok = false;
    } catch (_e) {
      notificacoes_ok = false;
    }
    if (!notificacoes_ok) {
      console.warn(`[confirmar-agendamento ${rid}] notificacao_falhou id=${r.agendamento_id}`);
    }

    return json({
      sucesso: true,
      agendamento_id: r.agendamento_id,
      mensagem_pronta: r.mensagem_pronta,
      notificacoes_ok,
      request_id: rid,
    });
  } catch (err) {
    console.error(`[confirmar-agendamento ${rid}] erro:`, (err as Error)?.message);
    return json({
      sucesso: false,
      motivo: "erro_interno",
      mensagem_pronta: null,
      request_id: rid,
    });
  }
});
