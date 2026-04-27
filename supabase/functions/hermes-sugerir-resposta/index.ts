// Hermes — Sugerir resposta contextual + persistir draft em hermes_drafts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
  agendamento_id?: string | null;
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
  telefone?: string | null;
  mensagens?: MensagemHistorico[];
  instrucao?: string | null;
}

const MODEL = "openai/gpt-5-mini";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    const ag = body.agendamento ?? null;
    const msgs = (body.mensagens ?? []).slice(-30);

    // Identifica usuário (admin) a partir do JWT (se presente)
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: u } = await userClient.auth.getUser();
        userId = u?.user?.id ?? null;
      } catch {/* ignore */}
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

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
        ].filter(Boolean).join("\n")
      : "Sem dados do agendamento.";

    const historico = msgs.length
      ? msgs.map((m) => `${m.direcao === "IN" ? "Paciente" : "Clínica"}: ${m.conteudo}`).join("\n")
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

    const t0 = Date.now();
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    const latencia_ms = Date.now() - t0;

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("Lovable AI error:", resp.status, txt);

      // Persiste erro também
      await admin.from("hermes_drafts").insert({
        agendamento_id: body.agendamento_id ?? null,
        telefone: body.telefone ?? null,
        sugestao: "(falha)",
        instrucao: body.instrucao ?? null,
        modelo: MODEL,
        latencia_ms,
        status: "error",
        created_by: userId,
        contexto_resumo: { erro: txt.slice(0, 500), http_status: resp.status, total_msgs: msgs.length },
      });

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
      return new Response(JSON.stringify({ error: "Falha ao gerar sugestão" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const sugestao: string = data?.choices?.[0]?.message?.content?.trim() ?? "";

    // Persiste o draft
    let draft_id: string | null = null;
    try {
      const { data: inserted } = await admin
        .from("hermes_drafts")
        .insert({
          agendamento_id: body.agendamento_id ?? null,
          telefone: body.telefone ?? null,
          sugestao,
          instrucao: body.instrucao ?? null,
          modelo: MODEL,
          latencia_ms,
          status: "pending",
          created_by: userId,
          contexto_resumo: {
            total_msgs: msgs.length,
            tem_agendamento: !!ag,
            is_sandbox: ag?.is_sandbox ?? false,
            status_crm: ag?.status_crm ?? null,
          },
        })
        .select("id")
        .single();
      draft_id = inserted?.id ?? null;
    } catch (e) {
      console.error("Falha ao persistir draft Hermes:", e);
    }

    return new Response(JSON.stringify({ sugestao, draft_id, latencia_ms }), {
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
