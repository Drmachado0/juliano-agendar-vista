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

// Generate HMAC-SHA256 signature for webhook payload
async function generateHmacSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const payloadData = encoder.encode(payload);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, payloadData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Schema validation for n8n notification request
const n8nRequestSchema = z.object({
  evento: z.enum(["agendamento_criado", "status_crm_atualizado"], {
    errorMap: () => ({ message: "Evento deve ser 'agendamento_criado' ou 'status_crm_atualizado'" })
  }),
  dados_agendamento: z.object({
    id: z.string().uuid().optional(),
    nome_completo: z.string().max(200).optional(),
    telefone_whatsapp: z.string().max(20).optional(),
    email: z.string().email().max(255).optional().nullable(),
    data_nascimento: z.string().optional().nullable(),
    tipo_atendimento: z.string().max(50).optional(),
    local_atendimento: z.string().max(200).optional(),
    convenio: z.string().max(100).optional(),
    convenio_outro: z.string().max(100).optional().nullable(),
    data_agendamento: z.string().optional().nullable(),
    hora_agendamento: z.string().optional().nullable(),
    status_crm: z.string().max(50).optional(),
    observacoes_internas: z.string().max(2000).optional().nullable(),
    detalhe_exame_ou_cirurgia: z.string().max(500).optional().nullable(),
    aceita_primeiro_horario: z.boolean().optional().nullable(),
    aceita_contato_whatsapp_email: z.boolean().optional().nullable(),
    origem: z.string().max(100).optional().nullable(),
    created_at: z.string().optional().nullable(),
    updated_at: z.string().optional().nullable(),
  }).passthrough(), // Allow additional fields for flexibility
});

type N8nRequest = z.infer<typeof n8nRequestSchema>;

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
    const validationResult = n8nRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: "Dados inválidos", 
          details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`) 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { evento, dados_agendamento }: N8nRequest = validationResult.data;

    console.log("Notificando n8n - Evento:", evento);
    console.log("Dados:", JSON.stringify(dados_agendamento).substring(0, 100) + "...");

    const n8nWebhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
    const n8nWebhookSecret = Deno.env.get("N8N_WEBHOOK_SECRET");

    if (!n8nWebhookUrl) {
      console.error("N8N_WEBHOOK_URL não configurado");
      return new Response(
        JSON.stringify({ error: "Webhook n8n não configurado" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Prepare payload with timestamp and request ID for deduplication
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const payload = JSON.stringify({
      evento,
      dados_agendamento,
      timestamp,
      request_id: requestId,
    });

    // Build request headers
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add HMAC signature if secret is configured
    if (n8nWebhookSecret) {
      const signature = await generateHmacSignature(payload, n8nWebhookSecret);
      requestHeaders["X-Webhook-Signature"] = `sha256=${signature}`;
      requestHeaders["X-Request-ID"] = requestId;
      requestHeaders["X-Timestamp"] = timestamp;
      console.log("HMAC signature added to request");
    } else {
      console.warn("N8N_WEBHOOK_SECRET not configured - sending without authentication");
    }

    // Call n8n webhook with HMAC authentication
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: requestHeaders,
      body: payload,
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error("Erro n8n webhook:", errorText);
      // Don't fail the request - n8n errors shouldn't block the main flow
      return new Response(
        JSON.stringify({ success: true, warning: "n8n webhook retornou erro, mas a operação continuou" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    let n8nData;
    const responseText = await n8nResponse.text();
    try {
      n8nData = JSON.parse(responseText);
    } catch {
      n8nData = responseText;
    }
    
    console.log("Resposta n8n:", JSON.stringify(n8nData));

    return new Response(
      JSON.stringify({ success: true, data: n8nData }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Erro na função notificar-n8n:", error);
    // Don't fail - automation errors shouldn't block the main flow
    return new Response(
      JSON.stringify({ success: true, warning: error.message }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
