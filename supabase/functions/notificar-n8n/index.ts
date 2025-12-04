import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface N8nRequest {
  evento: "agendamento_criado" | "status_crm_atualizado";
  dados_agendamento: Record<string, any>;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { evento, dados_agendamento }: N8nRequest = await req.json();

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
