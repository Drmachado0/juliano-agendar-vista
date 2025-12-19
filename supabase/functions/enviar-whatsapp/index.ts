import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 30000;

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
      if (typeof allowed === "string") {
        return allowed === origin;
      }
      return allowed.test(origin);
    });

    if (isAllowed) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
  }

  return headers;
}

// Schema validation for WhatsApp request
const whatsAppRequestSchema = z.object({
  telefone: z
    .string()
    .min(10, "Telefone deve ter no mínimo 10 dígitos")
    .max(15, "Telefone deve ter no máximo 15 dígitos")
    .regex(/^[\d\s\-\(\)\+]+$/, "Telefone contém caracteres inválidos"),
  mensagem: z
    .string()
    .min(1, "Mensagem não pode estar vazia")
    .max(4096, "Mensagem muito longa (máximo 4096 caracteres)"),
});

type WhatsAppRequest = z.infer<typeof whatsAppRequestSchema>;

// Error types for user-friendly messages
interface ErrorInfo {
  code: string;
  userMessage: string;
  technical: string;
}

function categorizeError(errorText: string, statusCode?: number): ErrorInfo {
  const lowerError = errorText.toLowerCase();
  
  if (lowerError.includes("connection closed") || lowerError.includes("connection refused")) {
    return {
      code: "CONNECTION_CLOSED",
      userMessage: "Não foi possível conectar ao WhatsApp. A instância pode estar desconectada. Tente novamente em alguns minutos.",
      technical: errorText,
    };
  }
  
  if (lowerError.includes("timeout") || lowerError.includes("aborted")) {
    return {
      code: "TIMEOUT",
      userMessage: "A requisição demorou muito para responder. Verifique a conexão e tente novamente.",
      technical: errorText,
    };
  }
  
  if (statusCode === 401 || lowerError.includes("unauthorized") || lowerError.includes("invalid api key")) {
    return {
      code: "AUTH_ERROR",
      userMessage: "Erro de autenticação com a Evolution API. Verifique as credenciais configuradas.",
      technical: errorText,
    };
  }
  
  if (statusCode === 404 || lowerError.includes("not found") || lowerError.includes("instance not found")) {
    return {
      code: "INSTANCE_NOT_FOUND",
      userMessage: "Instância do WhatsApp não encontrada. Verifique se a instância está configurada corretamente.",
      technical: errorText,
    };
  }
  
  if (lowerError.includes("not connected") || lowerError.includes("disconnected") || lowerError.includes("qr code")) {
    return {
      code: "NOT_CONNECTED",
      userMessage: "WhatsApp não está conectado. Escaneie o QR Code na Evolution API para reconectar.",
      technical: errorText,
    };
  }
  
  return {
    code: "UNKNOWN_ERROR",
    userMessage: "Erro ao enviar mensagem. Tente novamente em alguns instantes.",
    technical: errorText,
  };
}

// Delay helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Normalize phone number
function normalizePhone(telefone: string): string {
  let phoneFormatted = telefone.replace(/\D/g, "");
  if (!phoneFormatted.startsWith("55")) {
    phoneFormatted = "55" + phoneFormatted;
  }
  return phoneFormatted;
}

// Send message with retry
async function sendWithRetry(
  url: string,
  body: object,
  headers: Record<string, string>,
  maxRetries: number
): Promise<{ success: boolean; data?: any; error?: ErrorInfo }> {
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[enviar-whatsapp] Tentativa ${attempt}/${maxRetries}`);
    
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
      console.log(`[enviar-whatsapp] Status: ${response.status}, Response: ${responseText.substring(0, 500)}`);
      
      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          console.log("[enviar-whatsapp] Mensagem enviada com sucesso!");
          return { success: true, data };
        } catch {
          return { success: true, data: responseText };
        }
      }
      
      // Parse error response
      const errorInfo = categorizeError(responseText, response.status);
      
      // Determine if we should retry
      const isRetryable = [
        "CONNECTION_CLOSED",
        "TIMEOUT",
      ].includes(errorInfo.code);
      
      if (isRetryable && attempt < maxRetries) {
        const delayMs = BASE_DELAY_MS * attempt;
        console.log(`[enviar-whatsapp] Erro retryável (${errorInfo.code}). Aguardando ${delayMs}ms...`);
        await delay(delayMs);
        continue;
      }
      
      // Non-retryable or last attempt
      console.error(`[enviar-whatsapp] Erro não recuperável: ${errorInfo.code}`);
      return { success: false, error: errorInfo };
      
    } catch (err: any) {
      console.error(`[enviar-whatsapp] Exceção na tentativa ${attempt}:`, err.message);
      
      const isAbortError = err.name === "AbortError";
      const errorInfo = categorizeError(
        isAbortError ? "Request timeout - aborted" : err.message
      );
      
      if (attempt < maxRetries) {
        const delayMs = BASE_DELAY_MS * attempt;
        console.log(`[enviar-whatsapp] Aguardando ${delayMs}ms antes da próxima tentativa...`);
        await delay(delayMs);
        continue;
      }
      
      return { success: false, error: errorInfo };
    }
  }
  
  return {
    success: false,
    error: {
      code: "MAX_RETRIES",
      userMessage: "Não foi possível enviar após várias tentativas. Tente novamente mais tarde.",
      technical: `Failed after ${maxRetries} attempts`,
    },
  };
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[enviar-whatsapp] ========== NOVA REQUISIÇÃO ==========");

  try {
    const body = await req.json();
    
    // Validate input
    const validationResult = whatsAppRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error("[enviar-whatsapp] Erro de validação:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Dados inválidos",
          userMessage: validationResult.error.errors.map(e => e.message).join(", "),
          details: validationResult.error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { telefone, mensagem }: WhatsAppRequest = validationResult.data;

    // Get environment variables
    const evolutionBaseUrl = Deno.env.get("EVOLUTION_API_BASE_URL");
    const evolutionToken = Deno.env.get("EVOLUTION_API_TOKEN");
    const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE") || "SITEIA";

    console.log("[enviar-whatsapp] Config:", {
      baseUrl: evolutionBaseUrl,
      instance: instanceName,
      tokenPresent: !!evolutionToken,
    });

    if (!evolutionBaseUrl || !evolutionToken) {
      console.error("[enviar-whatsapp] Variáveis de ambiente não configuradas");
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Configuração incompleta",
          userMessage: "A Evolution API não está configurada corretamente. Contate o suporte.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Normalize phone
    const phoneFormatted = normalizePhone(telefone);
    console.log("[enviar-whatsapp] Telefone formatado:", phoneFormatted);
    console.log("[enviar-whatsapp] Mensagem (preview):", mensagem.substring(0, 100) + "...");

    // Build URL
    const fullUrl = `${evolutionBaseUrl}/message/sendText/${instanceName}`;
    console.log("[enviar-whatsapp] URL:", fullUrl);

    // Send with retry
    const result = await sendWithRetry(
      fullUrl,
      { number: phoneFormatted, text: mensagem },
      {
        "Content-Type": "application/json",
        "apikey": evolutionToken,
      },
      MAX_RETRIES
    );

    const elapsed = Date.now() - startTime;
    console.log(`[enviar-whatsapp] Finalizado em ${elapsed}ms. Sucesso: ${result.success}`);

    if (result.success) {
      return new Response(
        JSON.stringify({ success: true, data: result.data }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: result.error?.code || "UNKNOWN",
        userMessage: result.error?.userMessage || "Erro desconhecido",
        technical: result.error?.technical,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[enviar-whatsapp] Erro fatal após ${elapsed}ms:`, error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "INTERNAL_ERROR",
        userMessage: "Erro interno ao processar a requisição. Tente novamente.",
        technical: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
