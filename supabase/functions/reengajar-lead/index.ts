import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  agendamento_id: z.string().uuid(),
  mensagem: z.string().min(1).max(4096).optional(),
});

const TEMPLATE_PADRAO =
  "Oi! 😊 Vi que você começou a marcar uma consulta com a gente. Quer que eu continue de onde paramos? É só me responder por aqui.";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, motivo: "method_not_allowed" }, 405);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ ok: false, motivo: "json_invalido" }, 400); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ ok: false, motivo: "dados_invalidos", details: parsed.error.flatten() }, 400);
  }
  const { agendamento_id, mensagem } = parsed.data;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: ag, error: selErr } = await supabase
    .from("agendamentos")
    .select("id, telefone_whatsapp, bot_ativo, bot_pausado_ate, ultimo_followup_em")
    .eq("id", agendamento_id)
    .maybeSingle();

  if (selErr) return json({ ok: false, motivo: "erro_db", erro: selErr.message }, 500);
  if (!ag) return json({ ok: false, motivo: "agendamento_nao_encontrado" }, 404);

  const agora = Date.now();

  // Guarda 1: pausa humana vigente
  const pausaAte = ag.bot_pausado_ate ? new Date(ag.bot_pausado_ate).getTime() : 0;
  if (ag.bot_ativo === false || (pausaAte && pausaAte > agora)) {
    return json({ ok: false, motivo: "pausa_humana" });
  }

  // Guarda 2: follow-up recente (<24h)
  if (ag.ultimo_followup_em) {
    const last = new Date(ag.ultimo_followup_em).getTime();
    if (!Number.isNaN(last) && agora - last < 24 * 60 * 60 * 1000) {
      return json({ ok: false, motivo: "followup_recente" });
    }
  }

  if (!ag.telefone_whatsapp) {
    return json({ ok: false, motivo: "sem_telefone" }, 400);
  }

  const texto = (mensagem && mensagem.trim().length > 0) ? mensagem.trim() : TEMPLATE_PADRAO;

  // Envia via enviar-whatsapp (Z-API)
  const { data: envio, error: invokeErr } = await supabase.functions.invoke("enviar-whatsapp", {
    body: {
      telefone: ag.telefone_whatsapp,
      mensagem: texto,
      agendamento_id: ag.id,
      tipo_mensagem: "reengajamento",
    },
  });

  if (invokeErr) {
    return json({ ok: false, motivo: "erro_envio", erro: invokeErr.message }, 502);
  }
  if (envio && (envio as any).ok === false) {
    return json({ ok: false, motivo: "erro_envio", erro: (envio as any).erro || (envio as any).error || "Falha desconhecida" }, 502);
  }

  const agoraIso = new Date().toISOString();
  await supabase
    .from("agendamentos")
    .update({ ultimo_followup_em: agoraIso, updated_at: agoraIso })
    .eq("id", ag.id);

  await supabase.from("crm_audit_log").insert({
    agendamento_id: ag.id,
    user_id: null,
    user_email: "n8n@bot",
    user_name: "admin (reengajar)",
    acao: "reengajar_lead",
    status_anterior: null,
    status_novo: null,
    detalhes: { mensagem: texto, telefone: ag.telefone_whatsapp },
  });

  return json({ ok: true, success: true, agendamento_id: ag.id, ultimo_followup_em: agoraIso });
});
