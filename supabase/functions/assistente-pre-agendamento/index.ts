// Assistente automático de pré-agendamento via WhatsApp
// - Classifica intenção de cada mensagem IN (Prompt 6)
// - Se a intenção for agendar/remarcar, busca slots reais, envia mensagem ao paciente
//   e cria agendamento (status_funil='aguardando', status_crm='AGUARDANDO')
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendWhatsappTextMessage } from "../_shared/evolutionApiClient.ts";
import { requireN8nSecret, unauthorizedResponse, requestId } from "../_shared/authGuards.ts";
import {
  detectarAssuntoExames,
  buildHandoffExamesSummary,
  HANDOFF_EXAMES_REPLY,
  HANDOFF_NOTIFICATION_PHONE,
} from "../_shared/handoffExamesGuard.ts";
import { detectarValorConsulta } from "../_shared/respostasImediatasGuard.ts";
import {
  classificarExamePreco,
  replyPrecoExameTabelado,
  REPLY_EXAME_NAO_INFORMADO,
} from "../_shared/examesPrecoGuard.ts";
import { parseJanelaRelativa, podeOferecerHorarios } from "../_shared/disponibilidadeRelativa.ts";
import { maskTelefone } from "../_shared/telefoneCanonico.ts";



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INTENCOES = [
  "agendar",
  "remarcar",
  "cancelar",
  "confirmar_presenca",
  "exames",
  "duvida_preco",
  "duvida_convenio",
  "duvida_endereco",
  "duvida_horario",
  "pos_consulta",
  "urgencia",
  "saudacao",
  "outros",
] as const;

// Nunca inclua "exames" aqui — exames sempre viram handoff via guard determinístico.
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
  const result = await sendWhatsappTextMessage(phone, text);
  if (!result.success) {
    return { success: false, error: result.errorMessage ?? "Falha no envio de WhatsApp" };
  }
  return { success: true, externalId: result.messageId ?? null };
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
- "agendar": paciente quer marcar uma CONSULTA nova (nunca exame; exames vão para "exames").
- "exames": qualquer menção a exame(s) — pedido, guia, agendamento, local, autorização, cobertura, resultado, laudo, retorno com exames. NÃO tratar como agendar.
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
      // Usa RPC para manter status_crm/status_funil/estado_atendimento coerentes
      // e forçar bot_ativo=false ao escalar para humano.
      await supabase.rpc("transicionar_estado_agendamento", {
        p_id: id,
        p_novo_status_crm: "PRECISA_DE_HUMANO",
        p_motivo: `[BOT] ${motivo} · intenção: ${intencao}`,
      });
      await supabase
        .from("agendamentos")
        .update({
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
        status_crm: "PRECISA_DE_HUMANO",
        status_funil: "aguardando_humano",
        estado_atendimento: "humano",
        bot_ativo: false,
        bot_pausa_motivo: `[BOT] ${motivo} · intenção: ${intencao}`,
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
  const rid = requestId(req);

  // Guard server-to-server: aceita header x-n8n-secret (ou aliases) validado no Vault.
  const guard = await requireN8nSecret(req);
  if (!guard.ok) {
    console.warn("[assistente-pre-agendamento] unauthorized", { rid, reason: guard.reason });
    return unauthorizedResponse(guard.reason ?? "unauthorized", corsHeaders);
  }

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

    // 0) IDEMPOTÊNCIA por mensagem_id (item 10)
    // Se essa mensagem já produziu uma intent, retorna o registro sem reprocessar.
    if (body.mensagem_id) {
      const { data: jaProcessada } = await supabase
        .from("conversation_intents")
        .select("id, intencao, confianca, resumo, sentimento, proxima_acao, agendamento_id")
        .eq("mensagem_id", body.mensagem_id)
        .maybeSingle();
      if (jaProcessada) {
        return new Response(
          JSON.stringify({
            ok: true,
            duplicada: true,
            intent_id: jaProcessada.id,
            intencao: {
              intencao: jaProcessada.intencao,
              confianca: jaProcessada.confianca,
              resumo: jaProcessada.resumo,
              sentimento: jaProcessada.sentimento,
              proxima_acao: jaProcessada.proxima_acao,
            },
            agendamentoId: jaProcessada.agendamento_id ?? null,
            agiu: false,
            request_id: rid,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": rid } },
        );
      }
    }

    // Verifica se bot está ligado para este lead
    let botAtivo = true;
    let agendamento: any = null;
    if (body.agendamento_id) {
      const { data } = await supabase
        .from("agendamentos")
        .select("id, nome_completo, telefone_whatsapp, bot_ativo, status_funil, status_crm, local_atendimento, clinica_id, data_agendamento, hora_agendamento, origem")
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

    // =========================================================================
    // GUARDS DETERMINÍSTICOS — rodam ANTES do classificador/LLM.
    // Espelham a lógica de registrar-mensagem-in-n8n (defesa em profundidade,
    // caso o n8n dispare o assistente diretamente).
    // =========================================================================
    // Precedência (rev-3): preço exame tabelado > handoff HGP > valor consulta
    const precoExame = classificarExamePreco(body.conteudo);
    if (precoExame.kind === "preco_tabelado") {
      return new Response(
        JSON.stringify({
          ok: true,
          agiu: false,
          immediate_reply: true,
          immediate_reason: "valor_exame_tabelado",
          patient_reply: replyPrecoExameTabelado(precoExame.label),
          resume_agent: false,
          request_id: rid,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": rid } },
      );
    }
    if (precoExame.kind === "preco_generico_sem_exame") {
      return new Response(
        JSON.stringify({
          ok: true,
          agiu: false,
          immediate_reply: true,
          immediate_reason: "exame_nao_informado",
          patient_reply: REPLY_EXAME_NAO_INFORMADO,
          resume_agent: false,
          request_id: rid,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": rid } },
      );
    }

    const exames = detectarAssuntoExames(body.conteudo, historico);
    // Rev-4: se o histórico contém preço tabelado (paciente já foi convertido para
    // funil EXAMES_HGP com bot ativo), "sim/pode/quero" não deve gerar handoff.
    const historicoContemPrecoTabelado = (() => {
      const historicoTxt = (historico || [])
        .slice(-5)
        .map((m: any) => (m?.conteudo || "").toString())
        .filter(Boolean)
        .join(" \n ");
      return classificarExamePreco(historicoTxt).kind === "preco_tabelado";
    })();
    if (
      (exames.matched || precoExame.kind === "handoff_exame_nao_tabelado") &&
      !(exames.matched && exames.matchedInHistory && historicoContemPrecoTabelado)
    ) {
      const exameMencionado =
        precoExame.kind === "handoff_exame_nao_tabelado" ? precoExame.exameMencionado : null;
      const hits = exames.matched ? exames.hits : ["exame_nao_tabelado"];
      const idEscalado = await escalarParaHumano(supabase, {
        telefone: body.telefone,
        agendamentoId: body.agendamento_id ?? null,
        agendamento,
        motivo: "exame_avaliacao_hgp",
        intencao: "exames",
        detalhes: {
          request_id: rid,
          hits,
          matched_in_history: exames.matchedInHistory,
          exame_mencionado: exameMencionado,
        },
      });
      const notification_summary = buildHandoffExamesSummary({
        nome: agendamento?.nome_completo ?? null,
        telefoneMascarado: maskTelefone(body.telefone),
        mensagemAtual: body.conteudo,
        hits,
        matchedInHistory: exames.matchedInHistory,
        agendamentoId: idEscalado ?? agendamento?.id ?? null,
        statusCrm: agendamento?.status_crm ?? null,
        statusFunil: agendamento?.status_funil ?? null,
        localAtendimento: agendamento?.local_atendimento ?? null,
        exameMencionado,
      });
      return new Response(
        JSON.stringify({
          ok: true,
          agiu: false,
          handoff_required: true,
          handoff_reason: "exame_avaliacao_hgp",
          notify_required: true,
          notification_phone: HANDOFF_NOTIFICATION_PHONE,
          patient_reply: HANDOFF_EXAMES_REPLY,
          notification_summary,
          agendamentoId: idEscalado,
          request_id: rid,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": rid } },
      );
    }

    const valor = detectarValorConsulta(body.conteudo);
    if (valor.matched) {
      return new Response(
        JSON.stringify({
          ok: true,
          agiu: false,
          immediate_reply: true,
          immediate_reason: valor.reason,
          patient_reply: valor.reply,
          resume_agent: false, // resposta fixa já retoma o próximo dado no n8n
          request_id: rid,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": rid } },
      );
    }



    // 1) Classificar — se falhar (item 8), escala para humano e retorna agiu=false.
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
        p_detalhes: { stage: "classificar", error: msg, request_id: rid },
        p_latencia_ms: Date.now() - t0,
      });
      await escalarParaHumano(supabase, {
        telefone: body.telefone,
        agendamentoId: body.agendamento_id ?? null,
        agendamento,
        motivo: "classificador_falhou",
        intencao: "erro",
        detalhes: { error: msg, request_id: rid },
      });
      return new Response(
        JSON.stringify({
          ok: false, stage: "classificar", error: msg,
          escalado: "classificador_falhou", agiu: false, request_id: rid,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": rid } },
      );
    }

    // Persistir intenção (UNIQUE parcial em mensagem_id evita duplicata)
    const { error: intentErr } = await supabase.from("conversation_intents").insert({
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
    if (intentErr && !/duplicate key/i.test(intentErr.message)) {
      console.warn("[assistente-pre-agendamento] intent insert falhou", intentErr.message);
    }

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
        JSON.stringify({ ok: true, intencao, agiu: false, escalado: "intencao_sensivel", request_id: rid }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": rid } },
      );
    }

    if (botAtivo && (intencao.intencao === "outros" || intencao.confianca < 0.6)) {
      // Handoff = ÚLTIMO RECURSO. Em vez de escalar já na 1ª ambiguidade, o bot faz
      // UMA pergunta de esclarecimento. Só escala se a mensagem ANTERIOR já tinha sido
      // um pedido de esclarecimento (2ª mensagem seguida sem o bot entender), checado
      // no bot_assistente_log por telefone (desfecho != "classificou" nas últimas 4h).
      const { data: ultimoDesfecho } = await supabase
        .from("bot_assistente_log")
        .select("acao")
        .eq("telefone", body.telefone)
        .neq("acao", "classificou")
        .gte("created_at", new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      const jaPediuEsclarecimento = (ultimoDesfecho as any)?.[0]?.acao === "pediu_esclarecimento";

      if (!jaPediuEsclarecimento) {
        // 1ª ambiguidade → pergunta de esclarecimento (NÃO escala)
        const primeiroNome = agendamento?.nome_completo?.split(" ")[0] || "";
        const saud = primeiroNome ? `Oi, ${primeiroNome}! ` : "Oi! ";
        const pergunta = `${saud}Pra eu te ajudar certinho 🙂 — você quer *agendar* uma consulta, *remarcar/cancelar*, ou tirar uma *dúvida* (preço, convênio, endereço)? É só me dizer.`;
        const envioEsc = await sendWhatsappText(body.telefone, pergunta);
        await supabase.rpc("registrar_bot_log", {
          p_telefone: body.telefone,
          p_acao: envioEsc.success ? "pediu_esclarecimento" : "erro",
          p_agendamento_id: body.agendamento_id ?? null,
          p_intencao: intencao.intencao,
          p_detalhes: { confianca: intencao.confianca, resumo: intencao.resumo, envio: envioEsc },
        });
        if (!envioEsc.success) {
          // Falha REAL de envio → aí sim escala
          await escalarParaHumano(supabase, {
            telefone: body.telefone,
            agendamentoId: body.agendamento_id ?? null,
            agendamento,
            motivo: "envio_esclarecimento_falhou",
            intencao: intencao.intencao,
            detalhes: { confianca: intencao.confianca, envio: envioEsc },
          });
          return new Response(
            JSON.stringify({ ok: true, intencao, agiu: false, escalado: "envio_esclarecimento_falhou", request_id: rid }),
            { headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": rid } },
          );
        }
        return new Response(
          JSON.stringify({ ok: true, intencao, agiu: true, esclarecimento: true, request_id: rid }),
          { headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": rid } },
        );
      }

      // 2ª ambiguidade seguida → escala (agora sim, último recurso)
      await escalarParaHumano(supabase, {
        telefone: body.telefone,
        agendamentoId: body.agendamento_id ?? null,
        agendamento,
        motivo: "bot_nao_entendeu_apos_esclarecimento",
        intencao: intencao.intencao,
        detalhes: { confianca: intencao.confianca, resumo: intencao.resumo },
      });
      return new Response(
        JSON.stringify({ ok: true, intencao, agiu: false, escalado: "bot_nao_entendeu_apos_esclarecimento", request_id: rid }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": rid } },
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
        JSON.stringify({ ok: true, intencao, agiu: false, request_id: rid }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": rid } },
      );
    }

    // 3) Buscar slots (usado apenas para extrair DATAS disponíveis).
    const clinicaIds = agendamento?.clinica_id ? [agendamento.clinica_id] : [];
    const slots = await buscarProximosSlots(supabase, clinicaIds, 21, 12);

    // Estado de funil (mínimo): considera data "escolhida" apenas se veio na
    // mensagem atual uma data explícita reconhecível. Não usamos o
    // data_agendamento salvo em DB para não tratar sugestão prévia como
    // escolha do paciente.
    const janela = parseJanelaRelativa(body.conteudo);
    const dataExplicitaMatch = body.conteudo.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
    const estadoFunil = {
      fase: "aguardando_data" as const,
      data_escolhida: dataExplicitaMatch ? `${dataExplicitaMatch[3] || new Date().getFullYear()}-${String(dataExplicitaMatch[2]).padStart(2, "0")}-${String(dataExplicitaMatch[1]).padStart(2, "0")}` : null,
    };
    // Guard-rail: nunca ofereça HORÁRIOS antes de o paciente escolher uma DATA.
    const permitirHorarios = podeOferecerHorarios({
      fase: estadoFunil.data_escolhida ? "data_escolhida" : "aguardando_data",
      data_escolhida: estadoFunil.data_escolhida,
    });

    if (slots.length === 0) {
      const fallback =
        "Olá! Recebi sua solicitação de agendamento 😊\nNo momento não consegui localizar horários livres por aqui — nossa equipe vai te responder em instantes para encontrar a melhor data.";
      const envioFb = await sendWhatsappText(body.telefone, fallback);
      const idEscalado = await escalarParaHumano(supabase, {
        telefone: body.telefone,
        agendamentoId: body.agendamento_id ?? null,
        agendamento,
        motivo: envioFb.success ? "sem_slots" : "sem_slots_e_envio_falhou",
        intencao: intencao.intencao,
        detalhes: { envio: envioFb },
      });
      return new Response(
        JSON.stringify({
          ok: true, intencao, agiu: envioFb.success, fallback: true,
          escalado: envioFb.success ? "sem_slots" : "sem_slots_e_envio_falhou",
          agendamentoId: idEscalado, request_id: rid,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": rid } },
      );
    }

    // Extrai DATAS únicas (nunca mistura horários no mesmo passo).
    const datasUnicas = Array.from(new Set(slots.map((s) => s.data))).slice(0, 3);
    const nome = agendamento?.nome_completo?.split(" ")[0] || "";
    const saudacao = nome ? `Olá, ${nome}!` : "Olá!";
    const acao = intencao.intencao === "remarcar" ? "remarcar sua consulta" : "agendar uma consulta";

    let texto: string;
    if (permitirHorarios && estadoFunil.data_escolhida) {
      // Horários apenas depois de data escolhida explicitamente.
      const slotsNaData = slots.filter((s) => s.data === estadoFunil.data_escolhida).slice(0, 3);
      if (slotsNaData.length === 0) {
        // Data pedida sem agenda — cai em oferecer datas (regra 3).
        const linhasDatas = datasUnicas.map((d, i) => `${i + 1}) ${fmtDataBR(d)}`);
        texto = `${saudacao} 👋\nNão localizei horários para a data que você pediu${janela.periodoDia ? ` (${janela.periodoDia})` : ""}. Estas são as próximas datas disponíveis:\n${linhasDatas.join("\n")}\n\nMe diga o número da data preferida que retomamos com os horários 🙂`;
      } else {
        const linhas = slotsNaData.map((s, i) => `${i + 1}) ${s.hora}`);
        texto = `${saudacao} 👋\nPara ${fmtDataBR(estadoFunil.data_escolhida)} tenho estes horários:\n${linhas.join("\n")}\n\nResponda com o número do horário que prefere 🙂`;
      }
    } else {
      // Estado padrão: oferecer apenas DATAS. Horários virão depois da escolha.
      const linhasDatas = datasUnicas.map((d, i) => `${i + 1}) ${fmtDataBR(d)}`);
      const prefixo =
        janela.tipo !== "livre" || janela.periodoDia
          ? `Não localizei agenda para ${janela.tipo === "amanha" ? "amanhã" : janela.tipo === "hoje" ? "hoje" : "o período pedido"}${janela.periodoDia ? ` (${janela.periodoDia})` : ""}. `
          : "";
      texto = `${saudacao} 👋\nAqui é da clínica do Dr. Juliano Machado. Vi que você gostaria de ${acao}.\n\n${prefixo}Estas são as próximas datas disponíveis:\n${linhasDatas.join("\n")}\n\nMe diga o número da data preferida que retomamos com os horários 🙂`;
    }

    const envio = await sendWhatsappText(body.telefone, texto);

    if (!envio.success) {
      // NÃO avança status/agendamento. Escala para humano.
      const idEscalado = await escalarParaHumano(supabase, {
        telefone: body.telefone,
        agendamentoId: body.agendamento_id ?? null,
        agendamento,
        motivo: "envio_falhou",
        intencao: intencao.intencao,
        detalhes: { envio, slots },
      });
      await supabase.rpc("registrar_bot_log", {
        p_telefone: body.telefone,
        p_acao: "erro",
        p_agendamento_id: idEscalado,
        p_intencao: intencao.intencao,
        p_detalhes: { stage: "envio", envio, request_id: rid },
        p_latencia_ms: Date.now() - t0,
      });
      return new Response(
        JSON.stringify({
          ok: false, intencao, agiu: false, escalado: "envio_falhou",
          agendamentoId: idEscalado, error: envio.error, request_id: rid,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": rid } },
      );
    }

    // 5) Envio OK — cria/atualiza lead SEM gravar data/hora sugerida
    //    (não é escolha do paciente ainda). Fica AGUARDANDO escolha explícita.
    let agendamentoId = body.agendamento_id ?? null;

    if (!agendamentoId) {
      const { data: novo } = await supabase
        .from("agendamentos")
        .insert({
          nome_completo: nome || "Lead WhatsApp",
          telefone_whatsapp: body.telefone,
          tipo_atendimento: "Consulta",
          local_atendimento: "A definir",
          convenio: "Particular",
          origem: "bot_whatsapp",
          status_crm: "NOVO LEAD",
          status_funil: "novo",
          estado_atendimento: "novo",
        })
        .select("id")
        .single();
      agendamentoId = novo?.id ?? null;
    }

    if (agendamentoId) {
      await supabase.rpc("transicionar_estado_agendamento", {
        p_id: agendamentoId,
        p_novo_status_crm: "AGUARDANDO",
        p_motivo: `bot ofereceu ${datasUnicas.length} datas`,
      });
      await supabase
        .from("agendamentos")
        .update({ bot_ultima_acao_at: new Date().toISOString() })
        .eq("id", agendamentoId);
    }


    // Salva mensagem OUT
    await supabase.from("mensagens_whatsapp").insert({
      agendamento_id: agendamentoId,
      telefone: body.telefone,
      direcao: "OUT",
      conteudo: texto,
      status_envio: "enviado",
      mensagem_externa_id: envio.externalId,
      tipo_mensagem: "bot_pre_agendamento",
    });

    await supabase.rpc("registrar_bot_log", {
      p_telefone: body.telefone,
      p_acao: "criou_agendamento",
      p_agendamento_id: agendamentoId,
      p_intencao: intencao.intencao,
      p_detalhes: { slots, envio, request_id: rid },
      p_latencia_ms: Date.now() - t0,
    });

    return new Response(
      JSON.stringify({ ok: true, intencao, agiu: true, slots, agendamentoId, request_id: rid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": rid } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    console.error("[assistente-pre-agendamento] erro:", msg, { rid });
    return new Response(JSON.stringify({ ok: false, error: msg, request_id: rid }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": rid },
    });
  }
});
