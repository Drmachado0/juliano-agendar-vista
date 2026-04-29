import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function maskToken(token: string | undefined): string {
  if (!token) return "";
  if (token.length <= 8) return "•".repeat(token.length);
  return `${token.slice(0, 4)}${"•".repeat(Math.max(4, token.length - 8))}${token.slice(-4)}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: only admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = (Deno.env.get("EVOLUTION_API_BASE_URL") || "").replace(/\/+$/, "");
    const instance = Deno.env.get("EVOLUTION_API_INSTANCE") || "";
    const evoToken = Deno.env.get("EVOLUTION_API_TOKEN") || "";

    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
    }
    const action = (body.action as string) || "read";

    if (action === "read") {
      return new Response(
        JSON.stringify({
          baseUrl,
          instance,
          tokenMasked: maskToken(evoToken),
          tokenLength: evoToken.length,
          configured: Boolean(baseUrl && instance && evoToken),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "test") {
      // Test current credentials by calling connectionState
      if (!baseUrl || !instance || !evoToken) {
        return new Response(
          JSON.stringify({ ok: false, error: "Credenciais incompletas (baseUrl, instance ou token vazios)" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ctrl = new AbortController();
      const tId = setTimeout(() => ctrl.abort(), 10000);
      try {
        const resp = await fetch(`${baseUrl}/instance/connectionState/${instance}`, {
          method: "GET",
          headers: { apikey: evoToken },
          signal: ctrl.signal,
        });
        clearTimeout(tId);
        const text = await resp.text();
        let parsed: any;
        try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

        if (!resp.ok) {
          return new Response(
            JSON.stringify({
              ok: false,
              status: resp.status,
              error: parsed?.message || parsed?.error || `HTTP ${resp.status}`,
              details: parsed,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const state = parsed?.instance?.state || parsed?.state || "unknown";
        return new Response(
          JSON.stringify({ ok: true, state, connected: state === "open", instance, baseUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        clearTimeout(tId);
        return new Response(
          JSON.stringify({ ok: false, error: err?.name === "AbortError" ? "Timeout ao conectar" : err.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida. Use 'read' ou 'test'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[evolution-config] Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
