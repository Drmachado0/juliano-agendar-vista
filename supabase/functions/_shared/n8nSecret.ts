// ============================================================================
// Helper: lê o N8N_SHARED_SECRET.
// Fonte da verdade: tabela `integracao_secrets` (via RPC ler_secret_integracao).
// Fallback: env var `N8N_SHARED_SECRET` (compat com estado antes da migração).
// Cache em memória por 60s para não bater no DB a cada request.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SECRET_NAME = "N8N_SHARED_SECRET";
const CACHE_TTL_MS = 60 * 1000;

let cached: { value: string; expiresAt: number } | null = null;

function envFallback(): string {
  return (Deno.env.get(SECRET_NAME) || "").trim();
}

export async function getN8nSharedSecret(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  let value = "";
  if (url && key) {
    try {
      const admin = createClient(url, key);
      const { data, error } = await admin.rpc("ler_secret_integracao", {
        p_nome: SECRET_NAME,
      });
      if (!error && typeof data === "string" && data.length > 0) {
        value = data.trim();
      }
    } catch (e) {
      console.warn("[n8nSecret] fallback para env — RPC falhou:", (e as Error)?.message);
    }
  }

  if (!value) value = envFallback();

  // Só cacheia se veio valor; senão tenta de novo na próxima chamada.
  if (value) {
    cached = { value, expiresAt: now + CACHE_TTL_MS };
  }
  return value;
}

/** Invalida o cache. Chame após rotação para propagar mais rápido dentro do mesmo isolate. */
export function invalidateN8nSecretCache(): void {
  cached = null;
}

/** Comparação em tempo constante (para dificultar timing attacks). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
