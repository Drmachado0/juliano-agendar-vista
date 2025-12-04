import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AgendamentoData {
  nome_completo: string;
  tipo_atendimento: string;
  local_atendimento: string;
  data_agendamento: string;
  hora_agendamento: string;
  convenio: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agendamento }: { agendamento: AgendamentoData } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating confirmation message for:", agendamento.nome_completo);

    const systemPrompt = `Você é um assistente do consultório do Dr. Juliano Machado, oftalmologista. 
Gere mensagens de confirmação de agendamento profissionais, cordiais e personalizadas para WhatsApp.
As mensagens devem:
- Ser em português brasileiro
- Ter tom profissional mas acolhedor
- Incluir todos os dados relevantes do agendamento
- Lembrar o paciente de trazer documentos necessários
- Ter no máximo 500 caracteres
- Usar emojis de forma moderada (máximo 3)
- NÃO incluir saudações genéricas como "Olá" no início`;

    const userPrompt = `Gere uma mensagem de confirmação de agendamento para WhatsApp com os seguintes dados:

Nome do paciente: ${agendamento.nome_completo}
Tipo de atendimento: ${agendamento.tipo_atendimento}
Local: ${agendamento.local_atendimento}
Data: ${agendamento.data_agendamento}
Horário: ${agendamento.hora_agendamento}
Convênio: ${agendamento.convenio}

A mensagem deve confirmar o agendamento e incluir instruções relevantes.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos na sua conta Lovable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const mensagem = data.choices?.[0]?.message?.content?.trim();

    if (!mensagem) {
      throw new Error("No message generated");
    }

    console.log("Generated message:", mensagem.substring(0, 50) + "...");

    return new Response(
      JSON.stringify({ mensagem }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error generating confirmation message:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
