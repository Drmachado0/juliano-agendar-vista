// Hermes — Sugerir resposta contextual + ações + persistir draft em hermes_drafts
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
  tipo_origem?: string | null; // 'manual' | 'auto_escalacao'
}

const MODEL = "openai/gpt-5-mini";

const STATUS_VALIDOS = [
  "NOVO LEAD",
  "AGUARDANDO HUMANO",
  "AGUARDANDO",
  "CLINICOR",
  "HGP",
  "BELÉM",
  "ATENDIDO",
  "PERDIDO",
];

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
    const tipo_origem = body.tipo_origem ?? "manual";

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

    const systemPrompt = `Você é o Hermes, copiloto da secretária da clínica do Dr. Juliano Machado (oftalmologista em Paragominas/Belém).
Sua tarefa é gerar:
1) Uma mensagem curta (até 3 frases, máx ~280 caracteres) para a secretária ENVIAR ao paciente — cordial, profissional, em PT-BR, no máximo 1 emoji discreto, sem assinatura.
2) Um resumo de 1 frase do que o paciente quer.
3) Lista de ações sugeridas no CRM (ex.: mover status, agendar follow-up). Use apenas os tipos definidos.
NUNCA invente data/hora/preço/convênio que não estejam no contexto.`;

    const userPrompt = `Contexto do agendamento:
${contexto}

Histórico recente da conversa (mais antigo → mais recente):
${historico}

${body.instrucao ? `Instrução do atendente: ${body.instrucao}\n` : ""}Gere sugestão e ações.`;

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
        tools: [
          {
            type: "function",
            function: {
              name: "sugerir",
              description: "Sugere resposta para o paciente + ações no CRM.",
              parameters: {
                type: "object",
                properties: {
                  sugestao: { type: "string", description: "Mensagem pronta para enviar ao paciente." },
                  resumo: { type: "string", description: "Resumo curto do que o paciente quer." },
                  acoes: {
                    type: "array",
                    description: "Lista de 0 a 3 ações sugeridas para o atendente executar.",
                    items: {
                      type: "object",
                      properties: {
                        tipo: {
                          type: "string",
                          enum: [
                            "mover_status_crm",
                            "marcar_atendido",
                            "agendar_followup",
                            "marcar_perdido",
                            "nenhuma",
                          ],
                        },
                        status_destino: {
                          type: "string",
                          enum: STATUS_VALIDOS,
                          description: "Quando tipo=mover_status_crm, status para onde mover.",
                        },
                        descricao: { type: "string", description: "Frase curta explicando a ação." },
                      },
                      required: ["tipo", "descricao"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["sugestao", "resumo", "acoes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "sugerir" } },
      }),
    });
    const latencia_ms = Date.now() - t0;

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("Lovable AI error:", resp.status, txt);

      await admin.from("hermes_drafts").insert({
        agendamento_id: body.agendamento_id ?? null,
        telefone: body.telefone ?? null,
        sugestao: "(falha)",
        instrucao: body.instrucao ?? null,
        modelo: MODEL,
        latencia_ms,
        status: "error",
        tipo_origem,
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
    const toolArgs = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let sugestao = "";
    let resumo = "";
    let acoes: any[] = [];
    if (toolArgs) {
      try {
        const parsed = JSON.parse(toolArgs);
        sugestao = String(parsed.sugestao ?? "").trim();
        resumo = String(parsed.resumo ?? "").trim();
        acoes = Array.isArray(parsed.acoes) ? parsed.acoes : [];
      } catch (e) {
        console.error("Erro parse tool args:", e);
      }
    }
    if (!sugestao) {
      sugestao = (data?.choices?.[0]?.message?.content ?? "").trim();
    }

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
          tipo_origem,
          acoes_sugeridas: acoes,
          created_by: userId,
          contexto_resumo: {
            total_msgs: msgs.length,
            tem_agendamento: !!ag,
            is_sandbox: ag?.is_sandbox ?? false,
            status_crm: ag?.status_crm ?? null,
            resumo,
          },
        })
        .select("id")
        .single();
      draft_id = inserted?.id ?? null;
    } catch (e) {
      console.error("Falha ao persistir draft Hermes:", e);
    }

    return new Response(JSON.stringify({ sugestao, resumo, acoes, draft_id, latencia_ms }), {
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
