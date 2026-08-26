import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { CONFIRMATION_STATUS } from "../_shared/confirmationStatus.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  telefone: z.string().min(8),
  resposta: z.enum(["confirmar", "cancelar"]),
  subscriber_id: z.string().optional().nullable(),
  canal: z.string().default("whatsapp_manychat"),
  conteudo: z.string().optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const provided = req.headers.get("x-n8n-secret");
  if (!sharedSecret || provided !== sharedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  const body = parsed.data;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: telNorm } = await supabase.rpc("normalizar_telefone", { p_telefone: body.telefone });
  const telefoneNormalizado = (telNorm as string) ?? body.telefone.replace(/\D/g, "");
  const last8 = telefoneNormalizado.slice(-8);

  // Busca no banco inteiro, via RPC. Antes carregava os 200 agendamentos
  // mais recentes e filtrava em JS: paciente com agendamento fora dessa
  // janela nunca era encontrado e a resposta dele era descartada.
  // A RPC mantem o mesmo criterio de desempate: real antes de sandbox, com
  // data antes de sem data, mais recente antes de mais antigo.
  let agendamentoId: string | null = null;
  if (last8.length >= 8) {
    const { data: achado, error: errBusca } = await supabase.rpc(
      "buscar_agendamento_por_telefone_norm",
      { p_telefone_normalizado: telefoneNormalizado },
    );
    if (errBusca) {
      console.error("[n8n-resposta-confirmacao] busca:", errBusca.message);
    }
    agendamentoId = (achado as string | null) ?? null;
  }

  // Os dois valores anteriores ("confirmado_paciente"/"cancelado_paciente")
  // nao passavam na CHECK constraint da coluna: o UPDATE falhava, o erro so
  // era logado e a resposta do paciente sumia.
  const novoStatus =
    body.resposta === "confirmar"
      ? CONFIRMATION_STATUS.CONFIRMADO
      : CONFIRMATION_STATUS.CANCELADO_PELO_PACIENTE;

  if (agendamentoId) {
    const { error: updErr } = await supabase
      .from("agendamentos")
      .update({
        confirmation_status: novoStatus,
        confirmation_response_at: new Date().toISOString(),
      })
      .eq("id", agendamentoId);
    // Cancelou de verdade: o card tem que sair da coluna ativa. Sem isto o
    // confirmation_status virava 'cancelado_pelo_paciente' e o status_funil
    // seguia 'agendado' — secretaria continuava achando que o paciente vem.
    if (!updErr && body.resposta === "cancelar") {
      const { error: errTransicao } = await supabase.rpc("transicionar_estado_agendamento", {
        p_id: agendamentoId,
        p_novo_status_crm: "CANCELADO",
        p_motivo: "[PACIENTE] cancelou pelo WhatsApp",
      });
      if (errTransicao) {
        console.error("[n8n-resposta-confirmacao] transicao:", errTransicao.message);
      }
    }

    if (updErr) {
      // Falha aqui significa resposta do paciente perdida — nao pode sair
      // como ok:true, senao o n8n considera entregue e ninguem percebe.
      console.error("[n8n-resposta-confirmacao] update:", updErr.message);
      return json(
        { ok: false, motivo: "falha_ao_gravar_resposta", erro: updErr.message },
        500,
      );
    }
  } else {
    console.warn("[n8n-resposta-confirmacao] agendamento não encontrado para", telefoneNormalizado);
  }

  // Registra mensagem IN
  const { error: msgErr } = await supabase.from("mensagens_whatsapp").insert({
    agendamento_id: agendamentoId,
    telefone: telefoneNormalizado,
    direcao: "IN",
    conteudo: body.conteudo ?? (body.resposta === "confirmar" ? "Confirmar" : "Cancelar"),
    tipo_mensagem: "resposta_confirmacao",
    status_envio: "recebida",
    payload: {
      canal: body.canal,
      subscriber_id: body.subscriber_id ?? null,
      resposta: body.resposta,
    },
  });
  if (msgErr) console.error("[n8n-resposta-confirmacao] msg insert:", msgErr.message);

  return json({ ok: true, status: novoStatus, agendamento_id: agendamentoId });
});
