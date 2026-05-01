import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getEvolutionConfigAsync, invalidateEvolutionConfigCache } from "../_shared/evolutionApiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const reqId = crypto.randomUUID().slice(0, 8);
  const log = (...args: unknown[]) => console.log(`[evolution-config][${reqId}]`, ...args);
  const logErr = (...args: unknown[]) => console.error(`[evolution-config][${reqId}]`, ...args);

  try {
    log("=== NOVA REQUISIÇÃO ===", { method: req.method });

    // Auth: only admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      logErr("Sem Authorization Bearer");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const tokenJwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(tokenJwt);
    if (userErr || !userData?.user) {
      logErr("Falha auth.getUser:", userErr?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    log("Usuário autenticado:", userId);
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (roleErr) logErr("Erro has_role:", roleErr.message);
    if (!isAdmin) {
      logErr("Acesso negado — não é admin");
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
    }
    const action = (body.action as string) || "read";
    log("Ação:", action);

    // Cliente com auth do usuário (RPCs admin-only respeitam JWT)
    const supabaseAuthed = supabase;

    if (action === "read") {
      const { data, error } = await supabaseAuthed.rpc("obter_evolution_config_mascarada");
      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Compat com formato antigo do front
      const d = data as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          baseUrl: d?.base_url || "",
          instance: d?.instance || "",
          tokenMasked: d?.token_masked || "",
          tokenLength: d?.token_length || 0,
          configured: Boolean(d?.configured),
          updatedAt: d?.updated_at || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update") {
      const p_base_url = typeof body.base_url === "string" && body.base_url.trim() !== ""
        ? (body.base_url as string).trim() : null;
      const p_instance = typeof body.instance === "string" && body.instance.trim() !== ""
        ? (body.instance as string).trim() : null;
      const p_api_token = typeof body.api_token === "string" && body.api_token.trim() !== ""
        ? (body.api_token as string).trim() : null;

      if (!p_base_url && !p_instance && !p_api_token) {
        return new Response(
          JSON.stringify({ error: "Nenhum campo para atualizar" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabaseAuthed.rpc("atualizar_evolution_config", {
        p_base_url,
        p_instance,
        p_api_token,
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Invalida cache local desta instância da edge function
      invalidateEvolutionConfigCache();

      const d = data as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          success: true,
          baseUrl: d?.base_url || "",
          instance: d?.instance || "",
          tokenMasked: d?.token_masked || "",
          tokenLength: d?.token_length || 0,
          configured: Boolean(d?.configured),
          updatedAt: d?.updated_at || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "test") {
      // Testa as credenciais atualmente persistidas chamando connectionState
      let baseUrl = "";
      let instance = "";
      let evoToken = "";
      try {
        invalidateEvolutionConfigCache();
        const cfg = await getEvolutionConfigAsync();
        baseUrl = cfg.baseUrl;
        instance = cfg.instance;
        evoToken = cfg.token;
      } catch (e: any) {
        return new Response(
          JSON.stringify({ ok: false, error: e?.message || "Credenciais não configuradas" }),
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
      JSON.stringify({ error: "Ação inválida. Use 'read', 'update' ou 'test'." }),
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
