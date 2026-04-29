// Assistente automático de pré-agendamento via WhatsApp
// - Classifica intenção de cada mensagem IN (Prompt 6)
// - Se a intenção for agendar/remarcar, busca slots reais, envia mensagem ao paciente
//   e cria agendamento (status_funil='aguardando', status_crm='AGUARDANDO')
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INTENCOES = [
  "agendar",
  "remarcar",
  "cancelar",
  "confirmar_presenca",
  "duvida_preco",
  "duvida_convenio",
  "duvida_endereco",
  "duvida_horario",
  "pos_consulta",
  "urgencia",
  "saudacao",
  "outros",
] as const;

const INTENCOES_BOT = new Set(["agendar", "remarcar"]);
const INTENCOES_SENSIVEIS = new Set(["cancelar", "urgencia"]);

interface ReqBody {
  telefone: string;
  conteudo: string;
  agendamento_id?: string | null;
  mensagem_id?: string | null;
  historico?: { direcao: "IN" | "OUT"; conteudo: string }[];
}

function normalizePhoneBR(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  if ((d.length === 12 || d.length === 13) && !d.startsWith("55")) return "55" + d;
  return d;
}

async function sendWhatsappText(phone: string, text: string) {
  const baseUrl = Deno.env.get("EVOLUTION_API_BASE_URL");
  const instance = Deno.env.get("EVOLUTION_API_INSTANCE");
  const token = Deno.env.get("EVOLUTION_API_TOKEN");
  if (!baseUrl || !token) return { success: false, error: "Evolution API não configurada" };

  const url = `${baseUrl.replace(/\/$/, "")}/message/sendText/${instance}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: token },
    body: JSON.stringify({ number: normalizePhoneBR(phone), text }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    return { success: false, error: `HTTP ${resp.status}: ${t.slice(0, 200)}` };
  }
  const data = await resp.json().catch(() => ({}));
  return { success: true, externalId: data?.key?.id ?? null };
}

// Classifica intenção via Lovable AI (tool calling)
async function classificarIntencao(
  conteudo: string,
  historico: { direcao: string; conteudo: string }[],
) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

  const historicoTxt = historico
    .slice(-10)
    .map((m) => `${m.direcao === "IN" ? "Paciente" : "Clínica"}: ${m.conteudo}`)
    .join("\n");

  const systemPrompt = `Você é um classificador de intenção para conversas de WhatsApp de uma clínica oftalmológica.
Categorias possíveis: ${INTENCOES.join(", ")}.
Regras:
- "agendar": paciente quer marcar uma consulta/exame/cirurgia nova.
- "remarcar": paciente já tem agendamento e quer trocar data/hora.
- "cancelar": paciente quer desmarcar.
- "confirmar_presenca": confirmando ou negando presença em consulta marcada.
- "duvida_preco/convenio/endereco/horario": perguntas pontuais.
- "urgencia": dor intensa, perda de visão, emergência.
- "saudacao": apenas oi/bom dia, sem pedido.
- "outros": qualquer outra coisa.
Retorne sempre em português, com confianca 0..1.`;

  const userPrompt = `Histórico recente:
${historicoTxt || "(sem histórico)"}

Última mensagem do paciente:
"${conteudo}"`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "classificar",
            description: "Classifica intenção, sentimento e próxima ação.",
            parameters: {
              type: "object",
              properties: {
                intencao: { type: "string", enum: INTENCOES as unknown as string[] },
                confianca: { type: "number", minimum: 0, maximum: 1 },
                resumo: { type: "string", description: "Resumo de 1 frase do que o paciente quer." },
                sentimento: { type: "string", enum: ["positivo", "neutro", "negativo"] },
                proxima_acao: { type: "string", description: "Sugestão curta de próxima ação." },
              },
              required: ["intencao", "confianca", "resumo", "sentimento", "proxima_acao"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "classificar" } },
    }),
  });

  if (resp.status === 429) throw new Error("rate_limit");
  if (resp.status === 402) throw new Error("payment_required");
  if (!resp.ok) throw new Error(`gateway_${resp.status}`);

  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!call) throw new Error("sem_tool_call");
  return JSON.parse(call) as {
    intencao: string;
    confianca: number;
    resumo: string;
    sentimento: string;
    proxima_acao: string;
  };
}

// Busca próximos slots livres (mínimo 2) lendo disponibilidade_semanal/bloqueios direto
async function buscarProximosSlots(
  supabase: ReturnType<typeof createClient>,
  clinicaIds: string[],
  diasFuturo = 21,
  maxSlots = 3,
): Promise<{ data: string; hora: string; clinicaId: string | null }[]> {
  const hoje = new Date();
  const dataInicio = hoje.toISOString().split("T")[0];
  const dFim = new Date();
  dFim.setDate(dFim.getDate() + diasFuturo);
  const dataFim = dFim.toISOString().split("T")[0];

  let dispQuery = supabase.from("disponibilidade_semanal").select("*").eq("ativo", true);
  if (clinicaIds.length > 0) dispQuery = dispQuery.in("clinica_id", clinicaIds);
  else dispQuery = dispQuery.is("clinica_id", null);
  const { data: disps } = await dispQuery;

  const { data: ocupados } = await supabase.rpc("horarios_ocupados", {
    p_data_inicio: dataInicio,
    p_data_fim: dataFim,
    p_clinica_ids: clinicaIds.length > 0 ? clinicaIds : null,
  });
  const ocupSet = new Set(
    ((ocupados as any[]) || []).map(
      (o) => `${o.data_agendamento}_${String(o.hora_agendamento).slice(0, 5)}`,
    ),
  );

  let bloqQ = supabase
    .from("bloqueios_agenda")
    .select("*")
    .gte("data", dataInicio)
    .lte("data", dataFim);
  if (clinicaIds.length > 0) bloqQ = bloqQ.in("clinica_id", clinicaIds);
  const { data: bloqueios } = await bloqQ;
  const bloqMap = new Map<string, any[]>();
  for (const b of (bloqueios as any[]) || []) {
    const arr = bloqMap.get(b.data) || [];
    arr.push(b);
    bloqMap.set(b.data, arr);
  }

  const out: { data: string; hora: string; clinicaId: string | null }[] = [];
  const cur = new Date(hoje);
  cur.setHours(0, 0, 0, 0);
  const horaAtualMin = hoje.getHours() * 60 + hoje.getMinutes();

  for (let i = 0; i < diasFuturo && out.length < maxSlots; i++) {
    const d = new Date(cur);
    d.setDate(d.getDate() + i);
    const dataStr = d.toISOString().split("T")[0];
    const dow = d.getDay();
    const dispDia = (disps as any[] || []).filter((x) => x.dia_semana === dow);
    if (dispDia.length === 0) continue;

    const blDia = bloqMap.get(dataStr) || [];
    const diaInteiroBloqueado = (clinicaId: string | null) =>
      blDia.some(
        (b) =>
          (b.tipo_bloqueio === "dia_inteiro" || b.tipo_bloqueio === "feriado") &&
          (clinicaId === null || b.clinica_id === clinicaId),
      );

    for (const disp of dispDia) {
      if (diaInteiroBloqueado(disp.clinica_id)) continue;
      const [hi, mi] = disp.hora_inicio.split(":").map(Number);
      const [hf, mf] = disp.hora_fim.split(":").map(Number);
      let cm = hi * 60 + mi;
      const em = hf * 60 + mf;
      while (cm < em && out.length < maxSlots) {
        const hh = String(Math.floor(cm / 60)).padStart(2, "0");
        const mm = String(cm % 60).padStart(2, "0");
        const slot = `${hh}:${mm}`;
        cm += disp.intervalo_minutos || 30;

        if (i === 0 && cm <= horaAtualMin + 60) continue;
        if (ocupSet.has(`${dataStr}_${slot}`)) continue;

        const intervaloBloqueado = blDia.some((b) => {
          if (b.hora_inicio && b.hora_fim) {
            const ini = String(b.hora_inicio).slice(0, 5);
            const fim = String(b.hora_fim).slice(0, 5);
            return slot >= ini && slot < fim && (b.clinica_id === disp.clinica_id);
          }
          return false;
        });
        if (intervaloBloqueado) continue;

        out.push({ data: dataStr, hora: slot, clinicaId: disp.clinica_id });
      }
    }
  }
  return out.slice(0, maxSlots);
}

function fmtDataBR(iso: string) {
  const [y, m, d] = iso.split("-");
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  const dias = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  return `${dias[dt.getDay()]} ${d}/${m}`;
}

// Move/cria lead na fila "Precisa de humano"
async function escalarParaHumano(
  supabase: ReturnType<typeof createClient>,
  params: {
    telefone: string;
    agendamentoId: string | null;
    agendamento: any;
    motivo: string;
    intencao: string;
    detalhes?: Record<string, unknown>;
  },
): Promise<string | null> {
  const { telefone, agendamentoId, agendamento, motivo, intencao, detalhes } = params;
  let id = agendamentoId;
  const obs = `[BOT] Escalado para humano · motivo: ${motivo} · intenção: ${intencao}`;

  if (id) {
    // Não rebaixar se já está em coluna avançada
    const statusAtual = agendamento?.status_crm;
    const protegidos = new Set(["CLINICOR", "HGP", "BELÉM", "ATENDIDO"]);
    if (!protegidos.has(statusAtual)) {
      await supabase
        .from("agendamentos")
        .update({
          status_crm: "AGUARDANDO HUMANO",
          status_funil: "aguardando_humano",
          bot_ultima_acao_at: new Date().toISOString(),
          observacoes_internas: obs,
        })
        .eq("id", id);
    }
  } else {
    const { data: novo } = await supabase
      .from("agendamentos")
      .insert({
        nome_completo: agendamento?.nome_completo || "Lead WhatsApp",
        telefone_whatsapp: telefone,
        tipo_atendimento: "Consulta",
        local_atendimento: "A definir",
        convenio: "Particular",
        origem: "bot_whatsapp",
        status_crm: "AGUARDANDO HUMANO",
        status_funil: "aguardando_humano",
        bot_ultima_acao_at: new Date().toISOString(),
        observacoes_internas: obs,
      })
      .select("id")
      .single();
    id = novo?.id ?? null;
  }

  await supabase.rpc("registrar_bot_log", {
    p_telefone: telefone,
    p_acao: "escalou_humano",
    p_agendamento_id: id,
    p_intencao: intencao,
    p_detalhes: { motivo, ...(detalhes ?? {}) },
  });

  return id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = Date.now();

  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.telefone || !body?.conteudo) {
      return new Response(JSON.stringify({ error: "telefone e conteudo são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verifica se bot está ligado para este lead
    let botAtivo = true;
    let agendamento: any = null;
    if (body.agendamento_id) {
      const { data } = await supabase
        .from("agendamentos")
        .select("id, nome_completo, telefone_whatsapp, bot_ativo, status_funil, status_crm, local_atendimento, clinica_id, data_agendamento, hora_agendamento")
        .eq("id", body.agendamento_id)
        .maybeSingle();
      agendamento = data;
      if (data && data.bot_ativo === false) botAtivo = false;
    }

    // Carrega histórico se não veio
    let historico = body.historico ?? [];
    if (historico.length === 0) {
      const last8 = body.telefone.replace(/\D/g, "").slice(-8);
      const { data: msgs } = await supabase
        .from("mensagens_whatsapp")
        .select("direcao, conteudo, created_at")
        .ilike("telefone", `%${last8}`)
        .order("created_at", { ascending: false })
        .limit(15);
      historico = ((msgs as any[]) || []).reverse().map((m) => ({
        direcao: m.direcao,
        conteudo: m.conteudo,
      }));
    }

    // 1) Classificar
    let intencao;
    try {
      intencao = await classificarIntencao(body.conteudo, historico);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.rpc("registrar_bot_log", {
        p_telefone: body.telefone,
        p_acao: "erro",
        p_agendamento_id: body.agendamento_id ?? null,
        p_mensagem_id: body.mensagem_id ?? null,
        p_detalhes: { stage: "classificar", error: msg },
        p_latencia_ms: Date.now() - t0,
      });
      return new Response(JSON.stringify({ ok: false, stage: "classificar", error: msg }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persistir intenção
    await supabase.from("conversation_intents").insert({
      agendamento_id: body.agendamento_id ?? null,
      mensagem_id: body.mensagem_id ?? null,
      telefone: body.telefone,
      intencao: intencao.intencao,
      confianca: intencao.confianca,
      resumo: intencao.resumo,
      sentimento: intencao.sentimento,
      proxima_acao: intencao.proxima_acao,
      modelo: "openai/gpt-5-mini",
      raw_output: intencao as any,
    });

    await supabase.rpc("registrar_bot_log", {
      p_telefone: body.telefone,
      p_acao: "classificou",
      p_agendamento_id: body.agendamento_id ?? null,
      p_mensagem_id: body.mensagem_id ?? null,
      p_intencao: intencao.intencao,
      p_detalhes: intencao as any,
      p_latencia_ms: Date.now() - t0,
    });

    // 2) Decidir se bot age — escalar p/ humano em casos sensíveis ou de baixa confiança
    if (botAtivo && INTENCOES_SENSIVEIS.has(intencao.intencao)) {
      await escalarParaHumano(supabase, {
        telefone: body.telefone,
        agendamentoId: body.agendamento_id ?? null,
        agendamento,
        motivo: "intencao_sensivel",
        intencao: intencao.intencao,
        detalhes: { confianca: intencao.confianca, resumo: intencao.resumo },
      });
      return new Response(
        JSON.stringify({ ok: true, intencao, agiu: false, escalado: "intencao_sensivel" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (botAtivo && (intencao.intencao === "outros" || intencao.confianca < 0.6)) {
      await escalarParaHumano(supabase, {
        telefone: body.telefone,
        agendamentoId: body.agendamento_id ?? null,
        agendamento,
        motivo: "bot_nao_entendeu",
        intencao: intencao.intencao,
        detalhes: { confianca: intencao.confianca, resumo: intencao.resumo },
      });
      return new Response(
        JSON.stringify({ ok: true, intencao, agiu: false, escalado: "bot_nao_entendeu" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!botAtivo || !INTENCOES_BOT.has(intencao.intencao)) {
      await supabase.rpc("registrar_bot_log", {
        p_telefone: body.telefone,
        p_acao: "ignorou",
        p_agendamento_id: body.agendamento_id ?? null,
        p_intencao: intencao.intencao,
        p_detalhes: { motivo: !botAtivo ? "bot_desligado" : "intencao_fora_escopo" },
      });
      return new Response(
        JSON.stringify({ ok: true, intencao, agiu: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Buscar slots
    const clinicaIds = agendamento?.clinica_id ? [agendamento.clinica_id] : [];
    const slots = await buscarProximosSlots(supabase, clinicaIds, 21, 3);

    if (slots.length === 0) {
      const fallback =
        "Olá! Recebi sua solicitação de agendamento 😊\nNo momento não consegui localizar horários livres por aqui — nossa equipe vai te responder em instantes para encontrar a melhor data.";
      await sendWhatsappText(body.telefone, fallback);
      const idEscalado = await escalarParaHumano(supabase, {
        telefone: body.telefone,
        agendamentoId: body.agendamento_id ?? null,
        agendamento,
        motivo: "sem_slots",
        intencao: intencao.intencao,
      });
      return new Response(
        JSON.stringify({ ok: true, intencao, agiu: true, fallback: true, escalado: "sem_slots", agendamentoId: idEscalado }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4) Montar e enviar mensagem com horários + criar agendamento "AGUARDANDO" no primeiro slot
    const linhas = slots.map((s, i) => `${i + 1}) ${fmtDataBR(s.data)} às ${s.hora}`);
    const nome = agendamento?.nome_completo?.split(" ")[0] || "";
    const saudacao = nome ? `Olá, ${nome}!` : "Olá!";
    const texto = `${saudacao} 👋\nAqui é da clínica do Dr. Juliano Machado. Vi que você gostaria de ${
      intencao.intencao === "remarcar" ? "remarcar sua consulta" : "agendar uma consulta"
    }.\n\nTenho estes horários disponíveis:\n${linhas.join(
      "\n",
    )}\n\nResponda com o número do horário (1, 2 ou 3) que prefere, ou me diga outra data que combina melhor 🙂`;

    const envio = await sendWhatsappText(body.telefone, texto);

    // Criar/atualizar agendamento como AGUARDANDO no 1º slot sugerido
    let agendamentoId = body.agendamento_id ?? null;
    const primeiro = slots[0];

    if (agendamentoId) {
      await supabase
        .from("agendamentos")
        .update({
          status_funil: "aguardando",
          status_crm: "AGUARDANDO",
          data_agendamento: primeiro.data,
          hora_agendamento: primeiro.hora,
          clinica_id: primeiro.clinicaId ?? agendamento?.clinica_id ?? null,
          bot_ultima_acao_at: new Date().toISOString(),
          origem: agendamento?.origem || "bot_whatsapp",
        })
        .eq("id", agendamentoId);
    } else {
      const { data: novo } = await supabase
        .from("agendamentos")
        .insert({
          nome_completo: nome || "Lead WhatsApp",
          telefone_whatsapp: body.telefone,
          tipo_atendimento: "Consulta",
          local_atendimento: "A definir",
          convenio: "Particular",
          origem: "bot_whatsapp",
          status_crm: "AGUARDANDO",
          status_funil: "aguardando",
          data_agendamento: primeiro.data,
          hora_agendamento: primeiro.hora,
          clinica_id: primeiro.clinicaId ?? null,
          bot_ultima_acao_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      agendamentoId = novo?.id ?? null;
    }

    // Salva mensagem OUT
    if (envio.success) {
      await supabase.from("mensagens_whatsapp").insert({
        agendamento_id: agendamentoId,
        telefone: body.telefone,
        direcao: "OUT",
        conteudo: texto,
        status_envio: "enviado",
        mensagem_externa_id: envio.externalId,
        tipo_mensagem: "bot_pre_agendamento",
      });
    }

    await supabase.rpc("registrar_bot_log", {
      p_telefone: body.telefone,
      p_acao: envio.success ? "criou_agendamento" : "erro",
      p_agendamento_id: agendamentoId,
      p_intencao: intencao.intencao,
      p_detalhes: { slots, envio },
      p_latencia_ms: Date.now() - t0,
    });

    return new Response(
      JSON.stringify({ ok: true, intencao, agiu: true, slots, agendamentoId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    console.error("[assistente-pre-agendamento] erro:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
