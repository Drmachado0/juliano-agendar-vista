import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

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

  // Localiza agendamento ativo mais próximo (mesma lógica de buscar_agendamento_por_telefone,
  // executada com service role).
  let agendamentoId: string | null = null;
  if (last8.length >= 8) {
    const { data: candidatos } = await supabase
      .from("agendamentos")
      .select("id, telefone_whatsapp, created_at, is_sandbox, data_agendamento")
      .order("created_at", { ascending: false })
      .limit(200);
    const match = (candidatos ?? [])
      .filter((a: any) => (a.telefone_whatsapp ?? "").replace(/\D/g, "").endsWith(last8))
      .sort((a: any, b: any) => {
        const sb = Number(a.is_sandbox ?? false) - Number(b.is_sandbox ?? false);
        if (sb !== 0) return sb;
        const da = Number(!!b.data_agendamento) - Number(!!a.data_agendamento);
        if (da !== 0) return da;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })[0];
    agendamentoId = match?.id ?? null;
  }

  const novoStatus = body.resposta === "confirmar" ? "confirmado_paciente" : "cancelado_paciente";

  if (agendamentoId) {
    const { error: updErr } = await supabase
      .from("agendamentos")
      .update({
        confirmation_status: novoStatus,
        confirmation_response_at: new Date().toISOString(),
      })
      .eq("id", agendamentoId);
    if (updErr) console.error("[n8n-resposta-confirmacao] update:", updErr.message);
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
