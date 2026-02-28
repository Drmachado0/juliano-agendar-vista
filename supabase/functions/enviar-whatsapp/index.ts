import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// CORS configuration
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Schema validation
const whatsAppRequestSchema = z.object({
  telefone: z.string().min(10).max(15).regex(/^[\d\s\-\(\)\+]+$/),
  mensagem: z.string().min(1).max(4096),
});

type WhatsAppRequest = z.infer<typeof whatsAppRequestSchema>;

function normalizePhone(telefone: string): string {
  let phoneFormatted = telefone.replace(/\D/g, "");
  if (!phoneFormatted.startsWith("55")) {
    phoneFormatted = "55" + phoneFormatted;
  }
  return phoneFormatted;
}

function categorizeError(errorText: string, statusCode?: number): { code: string; message: string } {
  const lowerError = errorText.toLowerCase();
  
  if (lowerError.includes('"exists":false') || lowerError.includes('"exists": false')) {
    return {
      code: "NUMBER_NOT_EXISTS",
      message: "Número não encontrado no WhatsApp. Verifique se está correto.",
    };
  }
  
  if (lowerError.includes("not connected") || lowerError.includes("disconnected")) {
    return {
      code: "NOT_CONNECTED",
      message: "WhatsApp não está conectado. Escaneie o QR Code.",
    };
  }
  
  if (statusCode === 401 || lowerError.includes("unauthorized")) {
    return {
      code: "AUTH_ERROR",
      message: "Erro de autenticação com a Evolution API.",
    };
  }
  
  if (statusCode === 404 || lowerError.includes("not found")) {
    return {
      code: "INSTANCE_NOT_FOUND",
      message: "Instância do WhatsApp não encontrada.",
    };
  }
  
  if (lowerError.includes("timeout") || lowerError.includes("aborted")) {
    return {
      code: "TIMEOUT",
      message: "A requisição demorou muito. Tente novamente.",
    };
  }
  
  return {
    code: "UNKNOWN_ERROR",
    message: "Erro ao enviar mensagem. Tente novamente.",
  };
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[enviar-whatsapp] === NOVA REQUISIÇÃO (Simplificado) ===");

  try {
    // 1. Parse and validate request
    const body = await req.json();
    const validationResult = whatsAppRequestSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("[enviar-whatsapp] Erro de validação:", validationResult.error.errors);
      return new Response(
        JSON.stringify({
          success: false,
          error: "VALIDATION_ERROR",
          userMessage: "Dados inválidos: " + validationResult.error.errors.map(e => e.message).join(", "),
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { telefone, mensagem }: WhatsAppRequest = validationResult.data;
    const phoneFormatted = normalizePhone(telefone);

    // 2. Get Evolution API config
    let evolutionBaseUrl = Deno.env.get("EVOLUTION_API_BASE_URL");
    const evolutionToken = Deno.env.get("EVOLUTION_API_TOKEN");
    const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE") || "Agente ia";

    if (!evolutionBaseUrl || !evolutionToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "CONFIG_ERROR",
          userMessage: "Evolution API não está configurada.",
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Remove trailing slash from base URL to prevent double slashes
    evolutionBaseUrl = evolutionBaseUrl.replace(/\/+$/, "");

    console.log("[enviar-whatsapp] Config:", { baseUrl: evolutionBaseUrl, instance: instanceName, telefone: phoneFormatted });

    // 3. Send message directly - NO connection check, NO retries
    const url = `${evolutionBaseUrl}/message/sendText/${instanceName}`;
    
    console.log("[enviar-whatsapp] Enviando mensagem...");
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionToken,
      },
      body: JSON.stringify({
        number: phoneFormatted,
        text: mensagem,
      }),
    });

    const responseText = await response.text();
    const elapsed = Date.now() - startTime;

    console.log("[enviar-whatsapp] Resposta:", {
      status: response.status,
      elapsed: `${elapsed}ms`,
      preview: responseText.substring(0, 200),
    });

    // 4. Handle response
    if (response.ok) {
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { raw: responseText };
      }

      console.log("[enviar-whatsapp] ✓ Mensagem enviada com sucesso");
      return new Response(
        JSON.stringify({ 
          success: true, 
          data,
          elapsed: `${elapsed}ms`,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Error response
    const errorInfo = categorizeError(responseText, response.status);
    console.error("[enviar-whatsapp] ✗ Erro:", errorInfo.code);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorInfo.code,
        userMessage: errorInfo.message,
        elapsed: `${elapsed}ms`,
      }),
      { 
        status: response.status >= 400 && response.status < 500 ? 400 : 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error("[enviar-whatsapp] Erro fatal:", error.message);

    return new Response(
      JSON.stringify({
        success: false,
        error: "INTERNAL_ERROR",
        userMessage: "Erro interno. Tente novamente.",
        elapsed: `${elapsed}ms`,
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
