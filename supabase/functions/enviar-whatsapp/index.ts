import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppRequest {
  telefone: string;
  mensagem: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telefone, mensagem }: WhatsAppRequest = await req.json();

    console.log("Enviando WhatsApp para:", telefone);
    console.log("Mensagem:", mensagem.substring(0, 50) + "...");

    const evolutionBaseUrl = Deno.env.get("EVOLUTION_API_BASE_URL");
    const evolutionToken = Deno.env.get("EVOLUTION_API_TOKEN");

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

    // Call Evolution API
    const evolutionResponse = await fetch(`${evolutionBaseUrl}/message/sendText/default`, {
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
