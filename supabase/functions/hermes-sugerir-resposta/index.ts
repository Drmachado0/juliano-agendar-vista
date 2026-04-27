// Hermes — Sugerir resposta contextual para o atendente no chat WhatsApp
// Usa Lovable AI Gateway (openai/gpt-5-mini) e recebe histórico + dados do agendamento.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MensagemHistorico {
  direcao: "IN" | "OUT";
  conteudo: string;
  created_at?: string;
}

interface Body {
  agendamento?: {
    nome_completo?: string | null;
    tipo_atendimento?: string | null;
    local_atendimento?: string | null;
    data_agendamento?: string | null;
    hora_agendamento?: string | null;
    convenio?: string | null;
    status_crm?: string | null;
    status_funil?: string | null;
    is_sandbox?: boolean | null;
  } | null;
  mensagens?: MensagemHistorico[];
  instrucao?: string | null; // dica opcional do atendente ("recusar", "remarcar", etc)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as Body;
    const ag = body.agendamento ?? null;
    const msgs = (body.mensagens ?? []).slice(-30); // últimas 30 mensagens

    const contexto = ag
      ? [
          `Paciente: ${ag.nome_completo ?? "(sem nome)"}`,
          ag.tipo_atendimento ? `Tipo: ${ag.tipo_atendimento}` : null,
          ag.local_atendimento ? `Local: ${ag.local_atendimento}` : null,
          ag.data_agendamento
            ? `Data: ${ag.data_agendamento}${ag.hora_agendamento ? " às " + ag.hora_agendamento.slice(0, 5) : ""}`
            : "Sem data agendada",
          ag.convenio ? `Convênio: ${ag.convenio}` : null,
          ag.status_crm ? `Status CRM: ${ag.status_crm}` : null,
          ag.is_sandbox ? "⚠️ Contato de TESTE (sandbox)" : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "Sem dados do agendamento.";

    const historico = msgs.length
      ? msgs
          .map((m) => `${m.direcao === "IN" ? "Paciente" : "Clínica"}: ${m.conteudo}`)
          .join("\n")
      : "(sem mensagens anteriores)";

    const systemPrompt = `Você é o Hermes, secretária virtual da clínica do Dr. Juliano Machado (oftalmologista em Paragominas/Belém).
Sua tarefa é sugerir UMA mensagem curta de resposta ao paciente, no tom da clínica:
- Cordial, profissional, em português brasileiro
- Até 3 frases curtas (máx ~280 caracteres)
- Sem assinatura "Atenciosamente" nem nome do atendente
- Use no máximo 1 emoji discreto se fizer sentido (✨, 😊, 👋)
- Nunca invente data/hora/preço/convênio que não estejam no contexto
- Se o paciente pediu algo que requer confirmação humana, peça gentilmente os dados que faltam
- Responda APENAS com o texto da mensagem sugerida — sem aspas, sem prefixos, sem explicações`;

    const userPrompt = `Contexto do agendamento:
${contexto}

Histórico recente da conversa (mais antigo → mais recente):
${historico}

${body.instrucao ? `Instrução do atendente: ${body.instrucao}\n` : ""}Sugira a próxima resposta da clínica ao paciente.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("Lovable AI error:", resp.status, txt);
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos no workspace Lovable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Falha ao gerar sugestão" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    const sugestao: string = data?.choices?.[0]?.message?.content?.trim() ?? "";

    return new Response(JSON.stringify({ sugestao }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("hermes-sugerir-resposta error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
