// ============================================================================
// n8n-registrar-envio (LEGADO)
// Mantido para compatibilidade com fluxos antigos. Reencaminha a lógica para
// as mesmas regras seguras do endpoint canônico registrar-envio-out-n8n:
//   - autenticação via requireN8nSecret (Vault + fallback env, timing-safe)
//   - idempotência por (provider, provider_message_id)
//   - confirmation_status APENAS para tipos de confirmação explícitos
// Novos consumidores devem migrar para /registrar-envio-out-n8n.
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { requireN8nSecret, unauthorizedResponse, requestId } from "../_shared/authGuards.ts";
import { telefoneCanonico as canonicalFallback, maskTelefone } from "../_shared/telefoneCanonico.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CONFIRMATION_TYPES = new Set([
  "confirmacao_automatica",
  "confirmacao_consulta",
]);

const BodySchema = z.object({
  agendamento_id: z.string().uuid().nullable().optional(),
  telefone: z.string().min(8),
  tipo_mensagem: z.string().default("confirmacao_automatica"),
  canal: z.string().default("whatsapp_manychat"),
  status_envio: z.enum(["enviado", "falha_envio", "entregue", "lido"]),
  subscriber_id: z.string().optional().nullable(),
  origem: z.string().optional().nullable(),
  conteudo: z.string().optional(),
  provider_message_id: z.string().optional().nullable(),
  erro: z.string().optional().nullable(),
});

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extra, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const rid = requestId(req);
  const rh = { "x-request-id": rid };

  const guard = await requireN8nSecret(req);
  if (!guard.ok) {
    return unauthorizedResponse(guard.reason ?? "unauthorized", { ...corsHeaders, ...rh });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "JSON inválido" }, 400, rh); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400, rh);
  const body = parsed.data;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const provider = (body.canal || "manychat").toLowerCase().includes("manychat")
    ? "manychat"
    : (body.canal || "manychat").toLowerCase();
  const providerMessageId = body.provider_message_id?.trim() || null;
  const statusEnvio = body.status_envio === "falha_envio" ? "erro" : body.status_envio;

  // Idempotência
  if (providerMessageId) {
    const { data: dup } = await supabase
      .from("mensagens_whatsapp")
      .select("id, agendamento_id")
      .eq("provider", provider)
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();
    if (dup) {
      return json({ ok: true, mensagem_id: dup.id, agendamento_id: dup.agendamento_id ?? null, duplicada: true }, 200, rh);
    }
  }

  const { data: telNorm } = await supabase.rpc("normalizar_telefone", { p_telefone: body.telefone });
  const telefoneNormalizado = (telNorm as string) ?? body.telefone.replace(/\D/g, "");

  const insertRow: Record<string, unknown> = {
    agendamento_id: body.agendamento_id ?? null,
    telefone: telefoneNormalizado,
    direcao: "OUT",
    conteudo: body.conteudo ?? "(enviado via ManyChat)",
    tipo_mensagem: body.tipo_mensagem,
    status_envio: statusEnvio,
    mensagem_externa_id: providerMessageId,
    provider,
    provider_message_id: providerMessageId,
    payload: {
      canal: body.canal,
      subscriber_id: body.subscriber_id ?? null,
      origem: body.origem ?? "n8n_manychat_legacy",
      request_id: rid,
      erro: body.erro ?? null,
    },
    error_message: body.erro ?? null,
  };

  const { error: msgErr } = await supabase.from("mensagens_whatsapp").insert(insertRow);
  if (msgErr && !(msgErr.code === "23505")) {
    console.error("[n8n-registrar-envio] insert:", msgErr.message);
    return json({ error: msgErr.message }, 500, rh);
  }

  // Confirmation update APENAS para tipos explícitos e status != erro
  if (
    body.agendamento_id &&
    CONFIRMATION_TYPES.has(body.tipo_mensagem) &&
    statusEnvio !== "erro"
  ) {
    const { error: updErr } = await supabase
      .from("agendamentos")
      .update({
        confirmacao_enviada: true,
        confirmation_status: "aguardando_confirmacao",
        confirmation_sent_at: new Date().toISOString(),
        confirmation_channel: "whatsapp",
      })
      .eq("id", body.agendamento_id);
    if (updErr) console.error("[n8n-registrar-envio] update agend:", updErr.message);
  }

  return json({ ok: true, duplicada: false }, 200, rh);
});
