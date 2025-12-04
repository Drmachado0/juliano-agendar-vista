import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

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

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Validate input
    const validationResult = whatsAppRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: "Dados inválidos", 
          details: validationResult.error.errors.map(e => e.message) 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { telefone, mensagem }: WhatsAppRequest = validationResult.data;

    const evolutionBaseUrl = Deno.env.get("EVOLUTION_API_BASE_URL");
    const evolutionToken = Deno.env.get("EVOLUTION_API_TOKEN");

    console.log("=== DEBUG EVOLUTION API ===");
    console.log("EVOLUTION_API_BASE_URL:", evolutionBaseUrl);
    console.log("Token presente:", evolutionToken ? "Sim" : "Não");

    if (!evolutionBaseUrl || !evolutionToken) {
      console.error("Variáveis de ambiente não configuradas");
      return new Response(
        JSON.stringify({ error: "Configuração da Evolution API incompleta" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Format phone number (remove non-digits, ensure country code)
    let phoneFormatted = telefone.replace(/\D/g, "");
    if (!phoneFormatted.startsWith("55")) {
      phoneFormatted = "55" + phoneFormatted;
    }

    // Build the full URL - Evolution API expects: BASE_URL/message/sendText/INSTANCE_NAME
    const fullUrl = `${evolutionBaseUrl}/message/sendText/default`;
    console.log("URL completa da Evolution:", fullUrl);
    console.log("Telefone formatado:", phoneFormatted);
    console.log("Mensagem:", mensagem.substring(0, 50) + "...");

    // Call Evolution API
    const evolutionResponse = await fetch(fullUrl, {
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

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      console.error("Erro Evolution API:", errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar mensagem via Evolution API" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const evolutionData = await evolutionResponse.json();
    console.log("Resposta Evolution:", JSON.stringify(evolutionData));

    return new Response(
      JSON.stringify({ success: true, data: evolutionData }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Erro na função enviar-whatsapp:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
