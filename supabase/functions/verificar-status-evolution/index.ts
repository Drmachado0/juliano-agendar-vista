import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstanceStatus {
  connected: boolean;
  state: string;
  instanceName: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[verificar-status-evolution] Verificando status da instância...");

  try {
    let evolutionBaseUrl = Deno.env.get("EVOLUTION_API_BASE_URL");
    const evolutionToken = Deno.env.get("EVOLUTION_API_TOKEN");
    const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE") || "Agente ia";

    if (!evolutionBaseUrl || !evolutionToken) {
      console.error("[verificar-status-evolution] Variáveis não configuradas");
      return new Response(
        JSON.stringify({
          connected: false,
          state: "not_configured",
          instanceName: "",
          error: "Evolution API não configurada",
        } as InstanceStatus),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Remove trailing slash from base URL to prevent double slashes
    evolutionBaseUrl = evolutionBaseUrl.replace(/\/+$/, "");

    // Check instance connection state
    const statusUrl = `${evolutionBaseUrl}/instance/connectionState/${instanceName}`;
    console.log("[verificar-status-evolution] URL:", statusUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(statusUrl, {
      method: "GET",
      headers: {
        "apikey": evolutionToken,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    console.log("[verificar-status-evolution] Response:", responseText);

    if (!response.ok) {
      // Try to parse error
      let errorMsg = "Erro ao verificar status";
      try {
        const errorData = JSON.parse(responseText);
        errorMsg = errorData.message || errorData.error || errorMsg;
      } catch {
        errorMsg = responseText || errorMsg;
      }

      return new Response(
        JSON.stringify({
          connected: false,
          state: "error",
          instanceName,
          error: errorMsg,
        } as InstanceStatus),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse successful response
    const data = JSON.parse(responseText);
    
    // Evolution API returns { instance: { state: "open" | "close" | "connecting" } }
    // or { state: "open" | "close" | "connecting" }
    const state = data?.instance?.state || data?.state || "unknown";
    const isConnected = state === "open";

    console.log("[verificar-status-evolution] Estado:", state, "Conectado:", isConnected);

    return new Response(
      JSON.stringify({
        connected: isConnected,
        state,
        instanceName,
      } as InstanceStatus),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[verificar-status-evolution] Erro:", error.message);
    
    const isTimeout = error.name === "AbortError";
    
    return new Response(
      JSON.stringify({
        connected: false,
        state: isTimeout ? "timeout" : "error",
        instanceName: Deno.env.get("EVOLUTION_API_INSTANCE") || "Agente ia",
        error: isTimeout ? "Tempo limite ao verificar status" : error.message,
      } as InstanceStatus),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
