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
      log("→ RPC obter_evolution_config_mascarada");
      const t0 = Date.now();
      const { data, error } = await supabaseAuthed.rpc("obter_evolution_config_mascarada");
      log("← RPC retornou em", Date.now() - t0, "ms", { hasError: !!error });
      if (error) {
        logErr("Erro RPC read:", error.message, "code:", (error as any).code, "details:", (error as any).details);
        return new Response(
          JSON.stringify({ error: error.message, step: "rpc_read" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const d = data as Record<string, unknown>;
      log("Read OK:", { instance: d?.instance, baseUrl: d?.base_url, tokenLength: d?.token_length, configured: d?.configured });
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

      log("Campos recebidos:", {
        base_url: p_base_url ? "✓ (" + p_base_url.length + " chars)" : "—",
        instance: p_instance ? "✓ '" + p_instance + "'" : "—",
        api_token: p_api_token ? "✓ (" + p_api_token.length + " chars) — tentará pgp_sym_encrypt" : "— (mantém atual)",
      });

      if (!p_base_url && !p_instance && !p_api_token) {
        logErr("Nenhum campo enviado");
        return new Response(
          JSON.stringify({ error: "Nenhum campo para atualizar" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      log("→ RPC atualizar_evolution_config (etapa: validação + UPDATE + encrypt_sensitive_data)");
      const t0 = Date.now();
      const { data, error } = await supabaseAuthed.rpc("atualizar_evolution_config", {
        p_base_url,
        p_instance,
        p_api_token,
      });
      const elapsed = Date.now() - t0;
      log("← RPC retornou em", elapsed, "ms", { hasError: !!error });

      if (error) {
        const msg = error.message || "";
        let step = "rpc_update";
        if (/pgp_sym_encrypt/i.test(msg)) step = "pgp_sym_encrypt (pgcrypto não acessível ou ENCRYPTION_KEY ausente)";
        else if (/encryption key|vault/i.test(msg)) step = "vault.ENCRYPTION_KEY (segredo do vault ausente)";
        else if (/decrypt_sensitive_data/i.test(msg)) step = "decrypt_sensitive_data (após salvar)";
        else if (/base_url inválida/i.test(msg)) step = "validação base_url";
        else if (/api_token muito curto/i.test(msg)) step = "validação api_token";
        else if (/Forbidden/i.test(msg)) step = "has_role check (RPC)";
        logErr("Erro RPC update — step:", step, "| msg:", msg, "| code:", (error as any).code, "| details:", (error as any).details, "| hint:", (error as any).hint);
        return new Response(
          JSON.stringify({ error: msg, step, code: (error as any).code, details: (error as any).details, hint: (error as any).hint }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      invalidateEvolutionConfigCache();
      log("Cache invalidado nesta instância da edge function");

      const d = data as Record<string, unknown>;
      log("Update OK:", { instance: d?.instance, baseUrl: d?.base_url, tokenLength: d?.token_length, configured: d?.configured });
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
      log("→ test: lendo config (invalidando cache primeiro)");
      let baseUrl = "";
      let instance = "";
      let evoToken = "";
      try {
        invalidateEvolutionConfigCache();
        const cfg = await getEvolutionConfigAsync();
        baseUrl = cfg.baseUrl;
        instance = cfg.instance;
        evoToken = cfg.token;
        log("Config carregada:", { baseUrl, instance, tokenLen: evoToken.length });
      } catch (e: any) {
        logErr("Falha ao carregar config (decrypt?):", e?.message);
        return new Response(
          JSON.stringify({ ok: false, step: "load_config", error: e?.message || "Credenciais não configuradas" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ctrl = new AbortController();
      const tId = setTimeout(() => ctrl.abort(), 10000);
      try {
        const url = `${baseUrl}/instance/connectionState/${instance}`;
        log("→ GET", url);
        const resp = await fetch(url, {
          method: "GET",
          headers: { apikey: evoToken },
          signal: ctrl.signal,
        });
        clearTimeout(tId);
        const text = await resp.text();
        log("← Evolution respondeu", resp.status, "body:", text.slice(0, 200));
        let parsed: any;
        try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

        if (!resp.ok) {
          return new Response(
            JSON.stringify({
              ok: false,
              step: "evolution_http",
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
        logErr("Erro fetch Evolution:", err?.message);
        return new Response(
          JSON.stringify({ ok: false, step: "evolution_fetch", error: err?.name === "AbortError" ? "Timeout ao conectar" : err.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    log("Ação inválida:", action);
    return new Response(
      JSON.stringify({ error: "Ação inválida. Use 'read', 'update' ou 'test'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[evolution-config] EXCEÇÃO não tratada:", msg, "\nstack:", stack);
    return new Response(
      JSON.stringify({ error: msg, step: "uncaught" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
