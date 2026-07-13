// ============================================================================
// n8n-registrar-envio (LEGADO)
// DEPRECATED: use `registrar-envio-out-n8n`. Mantido como PROXY puro para
// evitar drift de regras. Encaminha o mesmo x-n8n-secret e x-request-id,
// mapeia `status_envio` legado (falha_envio -> erro) e preserva status HTTP
// e body do canônico. Default seguro `tipo_mensagem='bot_agente'` — payload
// legado sem tipo NUNCA altera confirmation_* (só confirmacao_automatica/
// confirmacao_consulta com status=enviado/entregue/lido alteram o funil).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function newRequestId(): string {
  try {
    // deno-lint-ignore no-explicit-any
    const c: any = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch { /* ignore */ }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rid = req.headers.get("x-request-id") ?? newRequestId();
  const outHeaders = { ...corsHeaders, "x-request-id": rid };

  // Payload legado
  let raw: Record<string, unknown> = {};
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response(
      JSON.stringify({ error: "invalid_json", request_id: rid }),
      { status: 400, headers: { ...outHeaders, "Content-Type": "application/json" } },
    );
  }

  // Mapeamento legado → canônico
  const legadoStatus = String(raw.status_envio ?? "enviado").toLowerCase();
  const status = legadoStatus === "falha_envio" ? "erro" : legadoStatus;

  const canonicalBody: Record<string, unknown> = {
    telefone: raw.telefone,
    agendamento_id: raw.agendamento_id ?? null,
    conteudo: raw.conteudo,
    // Default seguro: bot_agente. Nunca voltar a confirmacao_automatica —
    // isso alteraria confirmation_* em payloads legados sem tipo explícito.
    tipo_mensagem: raw.tipo_mensagem ?? "bot_agente",

    canal: raw.canal ?? "whatsapp_manychat",
    provider: (raw as any).provider,
    provider_message_id: raw.provider_message_id ?? null,
    subscriber_id: raw.subscriber_id ?? null,
    origem: raw.origem ?? "n8n_manychat_legacy",
    request_id: rid,
    erro: raw.erro ?? null,
    status,
  };

  const projectUrl =
    Deno.env.get("SUPABASE_URL") ??
    Deno.env.get("VITE_SUPABASE_URL");
  if (!projectUrl) {
    return new Response(
      JSON.stringify({ error: "missing_supabase_url", request_id: rid }),
      { status: 500, headers: { ...outHeaders, "Content-Type": "application/json" } },
    );
  }
  const canonicalUrl = `${projectUrl.replace(/\/$/, "")}/functions/v1/registrar-envio-out-n8n`;

  // Encaminha secret/rid + authorization (verify_jwt=false do canônico ignora,
  // mas propagamos para trace); NÃO adicionamos service_role aqui.
  const fwdHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "x-request-id": rid,
  };
  const secret = req.headers.get("x-n8n-secret");
  if (secret) fwdHeaders["x-n8n-secret"] = secret;
  const auth = req.headers.get("authorization");
  if (auth) fwdHeaders["authorization"] = auth;
  const apikey = req.headers.get("apikey");
  if (apikey) fwdHeaders["apikey"] = apikey;

  let upstream: Response;
  try {
    upstream = await fetch(canonicalUrl, {
      method: "POST",
      headers: fwdHeaders,
      body: JSON.stringify(canonicalBody),
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "proxy_upstream_unreachable",
        request_id: rid,
        detail: (e as Error).message,
      }),
      { status: 502, headers: { ...outHeaders, "Content-Type": "application/json" } },
    );
  }

  // Preserva status/body e propaga x-request-id do upstream se vier
  const upstreamText = await upstream.text();
  const responseHeaders: Record<string, string> = {
    ...outHeaders,
    "Content-Type": upstream.headers.get("content-type") ?? "application/json",
  };
  const upstreamRid = upstream.headers.get("x-request-id");
  if (upstreamRid) responseHeaders["x-request-id"] = upstreamRid;

  return new Response(upstreamText, {
    status: upstream.status,
    headers: responseHeaders,
  });
});
