import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // 2s, 4s, 8s exponential backoff
const REQUEST_TIMEOUT_MS = 30000;
const RECONNECT_WAIT_MS = 5000;
const CONNECT_WAIT_MS = 3000;

// Allowed origins for CORS
const allowedOrigins = [
  "https://drjulianomachado.com.br",
  "https://www.drjulianomachado.com.br",
  /^https:\/\/.*\.lovable\.app$/,
  /^https:\/\/.*\.lovableproject\.com$/,
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (origin) {
    const isAllowed = allowedOrigins.some((allowed) => {
      if (typeof allowed === "string") return allowed === origin;
      return allowed.test(origin);
    });
    if (isAllowed) headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

// Schema validation
const whatsAppRequestSchema = z.object({
  telefone: z.string().min(10).max(15).regex(/^[\d\s\-\(\)\+]+$/),
  mensagem: z.string().min(1).max(4096),
});

type WhatsAppRequest = z.infer<typeof whatsAppRequestSchema>;

// Error types
interface ErrorInfo {
  code: string;
  userMessage: string;
  technical: string;
  isClientError?: boolean;
}

function categorizeError(errorText: string, statusCode?: number): ErrorInfo {
  const lowerError = errorText.toLowerCase();
  
  // Check for "number doesn't exist on WhatsApp" - this is the most common error
  if (lowerError.includes('"exists":false') || lowerError.includes('"exists": false')) {
    return {
      code: "NUMBER_NOT_EXISTS",
      userMessage: "Número não encontrado no WhatsApp. Verifique se o número está correto e possui WhatsApp ativo.",
      technical: errorText,
      isClientError: true,
    };
  }
  
  if (lowerError.includes("connection closed") || lowerError.includes("connection refused")) {
    return {
      code: "CONNECTION_CLOSED",
      userMessage: "Conexão com WhatsApp perdida. Tentando reconectar automaticamente...",
      technical: errorText,
    };
  }
  
  if (lowerError.includes("timeout") || lowerError.includes("aborted")) {
    return {
      code: "TIMEOUT",
      userMessage: "A requisição demorou muito. Tente novamente.",
      technical: errorText,
    };
  }
  
  if (statusCode === 401 || lowerError.includes("unauthorized")) {
    return {
      code: "AUTH_ERROR",
      userMessage: "Erro de autenticação com a Evolution API.",
      technical: errorText,
    };
  }
  
  if (statusCode === 404 || lowerError.includes("not found")) {
    return {
      code: "INSTANCE_NOT_FOUND",
      userMessage: "Instância do WhatsApp não encontrada.",
      technical: errorText,
    };
  }
  
  if (lowerError.includes("not connected") || lowerError.includes("disconnected")) {
    return {
      code: "NOT_CONNECTED",
      userMessage: "WhatsApp não está conectado. Escaneie o QR Code.",
      technical: errorText,
    };
  }
  
  return {
    code: "UNKNOWN_ERROR",
    userMessage: "Erro ao enviar mensagem. Tente novamente.",
    technical: errorText,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizePhone(telefone: string): string {
  let phoneFormatted = telefone.replace(/\D/g, "");
  if (!phoneFormatted.startsWith("55")) {
    phoneFormatted = "55" + phoneFormatted;
  }
  return phoneFormatted;
}

// ============ CONNECTION MANAGEMENT ============

async function checkConnectionState(
  baseUrl: string,
  instanceName: string,
  apiKey: string
): Promise<{ connected: boolean; state: string }> {
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
      console.log(`[enviar-whatsapp] Check estado falhou: ${response.status}`);
      return { connected: false, state: "error" };
    }

    const data = await response.json();
    const state = data?.instance?.state || data?.state || "unknown";
    console.log(`[enviar-whatsapp] Estado da conexão: ${state}`);
    return { connected: state === "open", state };
  } catch (err: any) {
    console.error(`[enviar-whatsapp] Erro ao verificar conexão:`, err.message);
    return { connected: false, state: "error" };
  }
}

async function restartInstance(
  baseUrl: string,
  instanceName: string,
  apiKey: string
): Promise<boolean> {
  try {
    console.log(`[enviar-whatsapp] Reiniciando instância ${instanceName}...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${baseUrl}/instance/restart/${instanceName}`, {
      method: "POST",
      headers: { "apikey": apiKey },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log(`[enviar-whatsapp] Restart status: ${response.status}`);
    return response.ok;
  } catch (err: any) {
    console.error(`[enviar-whatsapp] Erro ao reiniciar:`, err.message);
    return false;
  }
}

async function connectInstance(
  baseUrl: string,
  instanceName: string,
  apiKey: string
): Promise<boolean> {
  try {
    console.log(`[enviar-whatsapp] Forçando conexão ${instanceName}...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
      method: "GET",
      headers: { "apikey": apiKey },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log(`[enviar-whatsapp] Connect status: ${response.status}`);
    return response.ok;
  } catch (err: any) {
    console.error(`[enviar-whatsapp] Erro ao conectar:`, err.message);
    return false;
  }
}

async function ensureConnected(
  baseUrl: string,
  instanceName: string,
  apiKey: string
): Promise<{ ready: boolean; reconnected: boolean; error?: string }> {
  // Step 1: Check current state
  const initial = await checkConnectionState(baseUrl, instanceName, apiKey);
  
  if (initial.connected) {
    console.log("[enviar-whatsapp] ✓ Conexão OK");
    return { ready: true, reconnected: false };
  }

  console.log(`[enviar-whatsapp] ⚠ Estado: ${initial.state}. Iniciando reconexão automática...`);

  // Step 2: Restart instance
  await restartInstance(baseUrl, instanceName, apiKey);
  
  // Step 3: Wait 5 seconds
  console.log("[enviar-whatsapp] Aguardando 5s após restart...");
  await delay(RECONNECT_WAIT_MS);

  // Step 4: Check state again
  const afterRestart = await checkConnectionState(baseUrl, instanceName, apiKey);
  
  if (afterRestart.connected) {
    console.log("[enviar-whatsapp] ✓ Reconectado após restart");
    return { ready: true, reconnected: true };
  }

  // Step 5: Try connect
  console.log("[enviar-whatsapp] Tentando forçar conexão...");
  await connectInstance(baseUrl, instanceName, apiKey);
  
  // Step 6: Wait 3 seconds
  console.log("[enviar-whatsapp] Aguardando 3s após connect...");
  await delay(CONNECT_WAIT_MS);

  // Step 7: Final check
  const finalState = await checkConnectionState(baseUrl, instanceName, apiKey);
  
  if (finalState.connected) {
    console.log("[enviar-whatsapp] ✓ Reconectado após connect");
    return { ready: true, reconnected: true };
  }

  console.error(`[enviar-whatsapp] ✗ Falha na reconexão. Estado final: ${finalState.state}`);
  return { 
    ready: false, 
    reconnected: false, 
    error: `Não foi possível reconectar. Estado: ${finalState.state}. Pode ser necessário escanear o QR Code novamente.`
  };
}

// ============ SEND MESSAGE ============

async function sendMessage(
  url: string,
  body: object,
  headers: Record<string, string>
): Promise<{ success: boolean; data?: any; error?: ErrorInfo }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseText = await response.text();
    
    console.log(`[enviar-whatsapp] Send status: ${response.status}, Response: ${responseText.substring(0, 300)}`);

    if (response.ok) {
      try {
        return { success: true, data: JSON.parse(responseText) };
      } catch {
        return { success: true, data: responseText };
      }
    }

    return { success: false, error: categorizeError(responseText, response.status) };
  } catch (err: any) {
    const isTimeout = err.name === "AbortError";
    return {
      success: false,
      error: categorizeError(isTimeout ? "Request timeout" : err.message),
    };
  }
}

async function sendWithRetryAndReconnect(
  baseUrl: string,
  instanceName: string,
  apiKey: string,
  phoneFormatted: string,
  mensagem: string
): Promise<{ success: boolean; data?: any; error?: ErrorInfo; reconnected?: boolean }> {
  const url = `${baseUrl}/message/sendText/${instanceName}`;
  const headers = {
    "Content-Type": "application/json",
    "apikey": apiKey,
  };
  const body = { number: phoneFormatted, text: mensagem };

  let reconnected = false;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const delayMs = RETRY_DELAYS[attempt - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
    console.log(`[enviar-whatsapp] Tentativa ${attempt}/${MAX_RETRIES}`);

    const result = await sendMessage(url, body, headers);

    if (result.success) {
      console.log("[enviar-whatsapp] ✓ Mensagem enviada com sucesso!");
      return { success: true, data: result.data, reconnected };
    }

    // Don't retry client errors (like NUMBER_NOT_EXISTS) - retrying won't help
    if (result.error?.isClientError) {
      console.log(`[enviar-whatsapp] ✗ Erro de cliente: ${result.error.code}. Não faz sentido tentar novamente.`);
      return { success: false, error: result.error, reconnected };
    }

    // Check if it's a connection error that warrants reconnection
    if (result.error?.code === "CONNECTION_CLOSED" || result.error?.code === "NOT_CONNECTED") {
      console.log(`[enviar-whatsapp] Erro de conexão detectado. Tentando reconectar...`);
      
      const reconnectResult = await ensureConnected(baseUrl, instanceName, apiKey);
      
      if (reconnectResult.ready) {
        reconnected = true;
        console.log("[enviar-whatsapp] Reconectado! Retentando envio...");
        // Don't count this as an attempt, retry immediately
        const retryResult = await sendMessage(url, body, headers);
        if (retryResult.success) {
          return { success: true, data: retryResult.data, reconnected: true };
        }
      } else {
        // Can't reconnect, return error
        return {
          success: false,
          error: {
            code: "RECONNECT_FAILED",
            userMessage: reconnectResult.error || "Não foi possível reconectar ao WhatsApp.",
            technical: "Auto-reconnect failed",
          },
          reconnected: false,
        };
      }
    }

    // For other errors, apply exponential backoff
    if (attempt < MAX_RETRIES) {
      console.log(`[enviar-whatsapp] Erro: ${result.error?.code}. Aguardando ${delayMs}ms...`);
      await delay(delayMs);
    } else {
      console.error(`[enviar-whatsapp] ✗ Falha após ${MAX_RETRIES} tentativas`);
      return { success: false, error: result.error, reconnected };
    }
  }

  return {
    success: false,
    error: {
      code: "MAX_RETRIES",
      userMessage: "Não foi possível enviar após várias tentativas.",
      technical: `Failed after ${MAX_RETRIES} attempts`,
    },
    reconnected,
  };
}

// ============ HANDLER ============

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[enviar-whatsapp] ========== NOVA REQUISIÇÃO ==========");

  try {
    const body = await req.json();
    const validationResult = whatsAppRequestSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("[enviar-whatsapp] Erro de validação:", validationResult.error.errors);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Dados inválidos",
          userMessage: validationResult.error.errors.map(e => e.message).join(", "),
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { telefone, mensagem }: WhatsAppRequest = validationResult.data;

    const evolutionBaseUrl = Deno.env.get("EVOLUTION_API_BASE_URL");
    const evolutionToken = Deno.env.get("EVOLUTION_API_TOKEN");
    const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE") || "SITEIA";

    console.log("[enviar-whatsapp] Config:", { baseUrl: evolutionBaseUrl, instance: instanceName });

    if (!evolutionBaseUrl || !evolutionToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Configuração incompleta",
          userMessage: "A Evolution API não está configurada.",
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const phoneFormatted = normalizePhone(telefone);
    console.log("[enviar-whatsapp] Telefone:", phoneFormatted);

    // Step 1: Ensure connection before sending
    console.log("[enviar-whatsapp] Verificando conexão antes do envio...");
    const connectionCheck = await ensureConnected(evolutionBaseUrl, instanceName, evolutionToken);

    if (!connectionCheck.ready) {
      const elapsed = Date.now() - startTime;
      console.error(`[enviar-whatsapp] ✗ Conexão não disponível após ${elapsed}ms`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "NOT_CONNECTED",
          userMessage: connectionCheck.error || "WhatsApp não conectado. Escaneie o QR Code.",
        }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Step 2: Send with retry and reconnect logic
    const result = await sendWithRetryAndReconnect(
      evolutionBaseUrl,
      instanceName,
      evolutionToken,
      phoneFormatted,
      mensagem
    );

    const elapsed = Date.now() - startTime;
    console.log(`[enviar-whatsapp] Finalizado em ${elapsed}ms. Sucesso: ${result.success}`);

    if (result.success) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: result.data,
          reconnected: result.reconnected,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use 400 for client errors (like invalid phone number), 500 for server errors
    const statusCode = result.error?.isClientError ? 400 : 500;
    
    return new Response(
      JSON.stringify({
        success: false,
        error: result.error?.code || "UNKNOWN",
        userMessage: result.error?.userMessage || "Erro desconhecido",
        technical: result.error?.technical,
      }),
      { status: statusCode, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[enviar-whatsapp] Erro fatal após ${elapsed}ms:`, error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "INTERNAL_ERROR",
        userMessage: "Erro interno. Tente novamente.",
        technical: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
