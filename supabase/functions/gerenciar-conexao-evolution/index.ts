import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConnectionResult {
  success: boolean;
  action: string;
  state?: string;
  connected?: boolean;
  error?: string;
  details?: any;
}

// Delay helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check connection state
async function checkConnectionState(
  baseUrl: string,
  instanceName: string,
  apiKey: string
): Promise<{ connected: boolean; state: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
      method: "GET",
      headers: { "apikey": apiKey },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      return { connected: false, state: "error", error: text };
    }

    const data = await response.json();
    const state = data?.instance?.state || data?.state || "unknown";
    return { connected: state === "open", state };
  } catch (err: any) {
    const isTimeout = err.name === "AbortError";
    return {
      connected: false,
      state: isTimeout ? "timeout" : "error",
      error: isTimeout ? "Timeout ao verificar conexão" : err.message,
    };
  }
}

// Restart instance
async function restartInstance(
  baseUrl: string,
  instanceName: string,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[gerenciar-conexao] Reiniciando instância ${instanceName}...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${baseUrl}/instance/restart/${instanceName}`, {
      method: "POST",
      headers: { "apikey": apiKey },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await response.text();
    console.log(`[gerenciar-conexao] Restart response (${response.status}):`, text);

    if (!response.ok) {
      return { success: false, error: text };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[gerenciar-conexao] Erro ao reiniciar:", err.message);
    return { success: false, error: err.message };
  }
}

// Connect instance (generate QR or reconnect)
async function connectInstance(
  baseUrl: string,
  instanceName: string,
  apiKey: string
): Promise<{ success: boolean; qrcode?: string; error?: string }> {
  try {
    console.log(`[gerenciar-conexao] Conectando instância ${instanceName}...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
      method: "GET",
      headers: { "apikey": apiKey },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await response.text();
    console.log(`[gerenciar-conexao] Connect response (${response.status}):`, text.substring(0, 200));

    if (!response.ok) {
      return { success: false, error: text };
    }

    try {
      const data = JSON.parse(text);
      return { success: true, qrcode: data?.qrcode?.base64 || data?.base64 };
    } catch {
      return { success: true };
    }
  } catch (err: any) {
    console.error("[gerenciar-conexao] Erro ao conectar:", err.message);
    return { success: false, error: err.message };
  }
}

// Full reconnect flow: restart → wait → check → connect if needed
async function fullReconnect(
  baseUrl: string,
  instanceName: string,
  apiKey: string
): Promise<ConnectionResult> {
  console.log("[gerenciar-conexao] Iniciando reconexão completa...");

  // Step 1: Restart
  const restartResult = await restartInstance(baseUrl, instanceName, apiKey);
  if (!restartResult.success) {
    console.log("[gerenciar-conexao] Restart falhou, tentando connect direto...");
  }

  // Step 2: Wait 5 seconds
  console.log("[gerenciar-conexao] Aguardando 5s após restart...");
  await delay(5000);

  // Step 3: Check state
  const checkResult = await checkConnectionState(baseUrl, instanceName, apiKey);
  console.log("[gerenciar-conexao] Estado após restart:", checkResult.state);

  if (checkResult.connected) {
    return {
      success: true,
      action: "reconnect",
      state: checkResult.state,
      connected: true,
    };
  }

  // Step 4: Try connect
  const connectResult = await connectInstance(baseUrl, instanceName, apiKey);
  if (!connectResult.success) {
    return {
      success: false,
      action: "reconnect",
      state: checkResult.state,
      connected: false,
      error: connectResult.error || "Falha ao conectar",
    };
  }

  // Step 5: Wait 3 seconds and check again
  console.log("[gerenciar-conexao] Aguardando 3s após connect...");
  await delay(3000);

  const finalCheck = await checkConnectionState(baseUrl, instanceName, apiKey);
  console.log("[gerenciar-conexao] Estado final:", finalCheck.state);

  return {
    success: finalCheck.connected,
    action: "reconnect",
    state: finalCheck.state,
    connected: finalCheck.connected,
    details: { qrcode: connectResult.qrcode },
    error: finalCheck.connected ? undefined : "Instância ainda não conectada após reconexão",
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[gerenciar-conexao] ========== NOVA REQUISIÇÃO ==========");

  try {
    let evolutionBaseUrl = Deno.env.get("EVOLUTION_API_BASE_URL");
    const evolutionToken = Deno.env.get("EVOLUTION_API_TOKEN");
    const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE") || "Agente ia";

    if (!evolutionBaseUrl || !evolutionToken) {
      return new Response(
        JSON.stringify({
          success: false,
          action: "config",
          error: "Evolution API não configurada",
        } as ConnectionResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Remove trailing slash from base URL to prevent double slashes
    evolutionBaseUrl = evolutionBaseUrl.replace(/\/+$/, "");

    // Parse action from request body
    let action = "check";
    try {
      const body = await req.json();
      action = body.action || "check";
    } catch {
      // Default to check if no body
    }

    console.log(`[gerenciar-conexao] Ação: ${action}, Instância: ${instanceName}, BaseUrl: ${evolutionBaseUrl}`);

    let result: ConnectionResult;

    switch (action) {
      case "check": {
        const checkResult = await checkConnectionState(evolutionBaseUrl, instanceName, evolutionToken);
        result = {
          success: true,
          action: "check",
          state: checkResult.state,
          connected: checkResult.connected,
          error: checkResult.error,
        };
        break;
      }

      case "restart": {
        const restartResult = await restartInstance(evolutionBaseUrl, instanceName, evolutionToken);
        // Wait a bit and check state
        await delay(3000);
        const checkAfter = await checkConnectionState(evolutionBaseUrl, instanceName, evolutionToken);
        result = {
          success: restartResult.success,
          action: "restart",
          state: checkAfter.state,
          connected: checkAfter.connected,
          error: restartResult.error,
        };
        break;
      }

      case "connect": {
        const connectResult = await connectInstance(evolutionBaseUrl, instanceName, evolutionToken);
        // Wait a bit and check state
        await delay(3000);
        const checkAfter = await checkConnectionState(evolutionBaseUrl, instanceName, evolutionToken);
        result = {
          success: connectResult.success,
          action: "connect",
          state: checkAfter.state,
          connected: checkAfter.connected,
          details: { qrcode: connectResult.qrcode },
          error: connectResult.error,
        };
        break;
      }

      case "reconnect": {
        result = await fullReconnect(evolutionBaseUrl, instanceName, evolutionToken);
        break;
      }

      default:
        result = {
          success: false,
          action: action,
          error: `Ação desconhecida: ${action}`,
        };
    }

    console.log(`[gerenciar-conexao] Resultado:`, JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[gerenciar-conexao] Erro:", error.message);
    return new Response(
      JSON.stringify({
        success: false,
        action: "error",
        error: error.message,
      } as ConnectionResult),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
