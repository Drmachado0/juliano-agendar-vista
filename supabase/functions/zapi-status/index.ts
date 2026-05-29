// Edge function: consulta o status da instância Z-API.
// GET {ZAPI_BASE_URL}/instances/{ZAPI_INSTANCE}/token/{ZAPI_TOKEN}/status
// Headers: Client-Token

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const baseUrl = (Deno.env.get("ZAPI_BASE_URL") || "https://api.z-api.io").replace(/\/+$/, "");
    const instance = Deno.env.get("ZAPI_INSTANCE") || "";
    const token = Deno.env.get("ZAPI_TOKEN") || "";
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || "";

    const configured = Boolean(instance && token && clientToken);
    if (!configured) {
      return new Response(
        JSON.stringify({
          success: false,
          configured: false,
          error: "Z-API não configurada. Faltam ZAPI_INSTANCE / ZAPI_TOKEN / ZAPI_CLIENT_TOKEN.",
          envs: {
            ZAPI_BASE_URL: Boolean(Deno.env.get("ZAPI_BASE_URL")),
            ZAPI_INSTANCE: Boolean(instance),
            ZAPI_TOKEN: Boolean(token),
            ZAPI_CLIENT_TOKEN: Boolean(clientToken),
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = `${baseUrl}/instances/${instance}/token/${token}/status`;
    const resp = await fetch(url, {
      method: "GET",
      headers: { "Client-Token": clientToken },
    });
    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // Z-API retorna campos como: { connected: true, smartphoneConnected: true, session: "...", ... }
    const connected = data?.connected === true || data?.connected === "true";
    const smartphoneConnected = data?.smartphoneConnected === true || data?.smartphoneConnected === "true";

    return new Response(
      JSON.stringify({
        success: resp.ok,
        configured: true,
        status: resp.status,
        connected,
        smartphoneConnected,
        instance_id_masked: instance ? `${instance.slice(0, 6)}…${instance.slice(-4)}` : null,
        base_url: baseUrl,
        raw: data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, configured: true, error: e?.message ?? "Erro desconhecido" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
