// Helper compartilhado para autenticar chamadas administrativas em edge functions.
// Retorna o user_id do JWT do caller se ele for admin, senão null.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface AdminAuthResult {
  ok: boolean;
  userId: string | null;
  reason?: string;
}

/**
 * Valida o header Authorization: Bearer <JWT>, resolve o usuário e verifica
 * se ele tem role 'admin' via has_role.
 */
export async function requireAdmin(req: Request): Promise<AdminAuthResult> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, userId: null, reason: "missing_bearer_token" };
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) {
    return { ok: false, userId: null, reason: "server_misconfigured" };
  }

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return { ok: false, userId: null, reason: "invalid_token" };
  }
  const userId = userData.user.id;

  const admin = createClient(url, service);
  const { data: isAdmin, error: rpcErr } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (rpcErr || !isAdmin) {
    return { ok: false, userId, reason: "not_admin" };
  }
  return { ok: true, userId };
}

/**
 * Valida apenas o JWT (usuário autenticado, sem checar role). Retorna user_id.
 */
export async function requireUser(req: Request): Promise<AdminAuthResult> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, userId: null, reason: "missing_bearer_token" };
  }
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return { ok: false, userId: null, reason: "server_misconfigured" };
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return { ok: false, userId: null, reason: "invalid_token" };
  return { ok: true, userId: data.user.id };
}
