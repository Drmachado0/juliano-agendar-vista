// ============================================================================
// revelar-n8n-secret
// Retorna o valor atual do N8N_SHARED_SECRET para admins autenticados.
// Uso: botão "Copiar segredo atual" no painel admin.
// - Requer JWT de admin (has_role = 'admin').
// - Registra a leitura em system_logs para auditoria.
// - Fonte: RPC ler_secret_integracao; fallback env var N8N_SHARED_SECRET.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return json(
      { success: false, error: "UNAUTHORIZED", reason: auth.reason },
      401,
    );
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let valor = "";
  let fonte: "db" | "env" | "none" = "none";

  try {
    const { data, error } = await admin.rpc("ler_secret_integracao", {
      p_nome: "N8N_SHARED_SECRET",
    });
    if (!error && typeof data === "string" && data.length > 0) {
      valor = data.trim();
      fonte = "db";
    }
  } catch (_) {
    // ignore, tenta env
  }

  if (!valor) {
    const env = (Deno.env.get("N8N_SHARED_SECRET") || "").trim();
    if (env) {
      valor = env;
      fonte = "env";
    }
  }

  if (!valor) {
    return json(
      {
        success: false,
        error: "SECRET_NOT_SET",
        message:
          "N8N_SHARED_SECRET não está configurado. Rotacione o segredo para gerar um novo valor.",
      },
      404,
    );
  }

  // Auditoria — registra quem revelou, sem gravar o valor.
  try {
    await admin.from("system_logs").insert({
      level: "info",
      source: "revelar-n8n-secret",
      message: "N8N_SHARED_SECRET revelado no painel admin",
      metadata: { user_id: auth.userId, fonte },
    });
  } catch (e) {
    console.warn("[revelar-n8n-secret] falha ao logar:", (e as Error)?.message);
  }

  return json({ success: true, valor, fonte });
});
