import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    data_agendamento: z.string().optional(),
    hora_agendamento: z.string().optional(),
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

    // Call n8n webhook
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        evento,
        dados_agendamento,
        timestamp: new Date().toISOString(),
      }),
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
    try {
      n8nData = await n8nResponse.json();
    } catch {
      n8nData = await n8nResponse.text();
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
