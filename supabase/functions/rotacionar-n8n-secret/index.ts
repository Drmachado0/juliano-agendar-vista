// ============================================================================
// rotacionar-n8n-secret
// Rotaciona o segredo `N8N_SHARED_SECRET` no banco. Só admins autenticados.
// O valor em claro é retornado uma única vez ao chamador.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Cliente com o JWT do usuário para validar identidade
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) {
    return json({ error: "Unauthorized" }, 401);
  }
  const userId = claims.claims.sub as string;

  // Checa role admin via service_role (bypassa RLS)
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isAdminData, error: roleErr } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleErr || !isAdminData) {
    return json({ error: "Forbidden: admin role required" }, 403);
  }

  // Rotaciona via RPC autenticada pelo usuário (a RPC re-valida admin)
  const { data, error } = await userClient.rpc("rotacionar_secret_integracao", {
    p_nome: "N8N_SHARED_SECRET",
  });

  if (error) {
    console.error("[rotacionar-n8n-secret] RPC erro:", error.message);
    return json({ error: error.message }, 500);
  }

  // data = { nome, valor, versao, rotacionado_em, rotacionado_por_email }
  return json({ success: true, ...(data as Record<string, unknown>) });
});
