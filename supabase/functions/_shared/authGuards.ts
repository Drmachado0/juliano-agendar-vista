// ============================================================================
// authGuards.ts
// Guards centralizados para endpoints server-to-server (cron e n8n).
// Fonte primária dos segredos: RPC ler_secret_integracao (tabela integracao_secrets
// criptografada via vault). Fallback: Deno.env (compat migração).
// Comparação sempre timing-safe.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getN8nSharedSecret, timingSafeEqual } from "./n8nSecret.ts";

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: string; expiresAt: number }>();

async function readSecretFromVault(name: string): Promise<string> {
  const now = Date.now();
  const hit = cache.get(name);
  if (hit && hit.expiresAt > now) return hit.value;

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let value = "";
  if (url && key) {
    try {
      const admin = createClient(url, key);
      const { data, error } = await admin.rpc("ler_secret_integracao", { p_nome: name });
      if (!error && typeof data === "string" && data.length > 0) value = data.trim();
    } catch (_e) {
      // ignore, use env fallback
    }
  }
  if (!value) value = (Deno.env.get(name) || "").trim();
  if (value) cache.set(name, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

export function invalidateSecretCache(name?: string) {
  if (name) cache.delete(name);
  else cache.clear();
}

export interface GuardResult {
  ok: boolean;
  reason?: string;
}

/** Exige header x-cron-secret válido (ou Authorization: Bearer <CRON_SECRET>). */
export async function requireCronSecret(req: Request): Promise<GuardResult> {
  const expected = await readSecretFromVault("CRON_SECRET");
  if (!expected) return { ok: false, reason: "cron_secret_not_configured" };
  const h1 = req.headers.get("x-cron-secret") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (timingSafeEqual(h1, expected) || timingSafeEqual(bearer, expected)) return { ok: true };
  return { ok: false, reason: "invalid_cron_secret" };
}

/** Exige header x-n8n-secret válido (ou aliases). Usa helper unificado. */
export async function requireN8nSecret(req: Request): Promise<GuardResult> {
  const expected = await getN8nSharedSecret();
  if (!expected) return { ok: false, reason: "n8n_secret_not_configured" };
  const candidates = [
    req.headers.get("x-n8n-secret") ?? "",
    req.headers.get("x-mcp-secret") ?? "",
    req.headers.get("x-api-key") ?? "",
    req.headers.get("apikey") ?? "",
  ];
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) candidates.push(auth.slice(7).trim());
  for (const c of candidates) {
    if (c && timingSafeEqual(c, expected)) return { ok: true };
  }
  return { ok: false, reason: "invalid_n8n_secret" };
}

export function unauthorizedResponse(reason: string, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: "Unauthorized", reason }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/** Extrai/gera request id para correlação ponta-a-ponta. */
export function requestId(req: Request): string {
  return req.headers.get("x-request-id") || crypto.randomUUID();
}
