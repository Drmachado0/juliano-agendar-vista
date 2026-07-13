// ============================================================================
// registrar-mensagem-in-n8n
// Recebe mensagens IN vindas do n8n (originadas do ManyChat).
// Fluxo canônico:
//   1) requireN8nSecret (timing-safe) + x-request-id
//   2) Idempotência forte por mensagem_externa_id ANTES de qualquer mutação.
//      Se dup existir mas estiver órfã, tenta RPC de vinculação novamente.
//   3) Normaliza telefone (E.164). Erro da RPC → 500 sem PII.
//   4) Insere mensagens_whatsapp IN com agendamento_id=NULL,
//      provider='manychat', provider_message_id=externo e payload sanitizado.
//   5) Chama RPC public.vincular_mensagem_por_telefone(mensagem_id,nome).
//      Erro da RPC → responde 500 { error:'vinculo_falhou', persisted:true,
//      mensagem_id, request_id } para permitir retry idempotente pelo n8n
//      (a próxima tentativa cai em duplicata órfã e re-executa a RPC).
//   6) Backfill de nome quando o cadastro está com placeholder.
// NUNCA cria lead diretamente na Edge Function. NUNCA vaza PII no response.
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { requireN8nSecret, unauthorizedResponse, requestId } from "../_shared/authGuards.ts";
import { maskTelefone } from "../_shared/telefoneCanonico.ts";
import {
  detectarAssuntoExames,
  buildHandoffExamesSummary,
  HANDOFF_EXAMES_REPLY,
  HANDOFF_NOTIFICATION_PHONE,
} from "../_shared/handoffExamesGuard.ts";
import {
  detectarValorConsulta,
  composePatientReplyValor,
  PROXIMO_DADO_POR_ESTADO,
} from "../_shared/respostasImediatasGuard.ts";
import {
  classificarExamePreco,
  composePatientReplyPrecoExame,
  REPLY_EXAME_NAO_INFORMADO,
  detalheCanonicoExame,
  LOCAL_HGP_CANONICO,
} from "../_shared/examesPrecoGuard.ts";
import { isRegistroAtivo } from "../_shared/statusTerminais.ts";
import {
  resolveNextEstadoAtendimento,
  precisaRecomputar,
} from "../_shared/estadoAtendimentoResolver.ts";

// Estrutura persistida em mensagens_whatsapp.payload.guard_decision para
// garantir idempotência: duplicatas retornam EXATAMENTE a mesma decisão.
type GuardDecision = {
  handoff_required: boolean;
  handoff_reason: string | null;
  notify_required: boolean;
  notification_phone: string | null;
  notification_summary: string | null;
  immediate_reply: boolean;
  immediate_reason: string | null;
  resume_agent: boolean;
  patient_reply: string | null;
  computed_at: string;
  version: 4;
};

const EMPTY_DECISION: GuardDecision = {
  handoff_required: false,
  handoff_reason: null,
  notify_required: false,
  notification_phone: null,
  notification_summary: null,
  immediate_reply: false,
  immediate_reason: null,
  resume_agent: true,
  patient_reply: null,
  computed_at: "",
  version: 4,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  telefone: z.string().min(8),
  conteudo: z.string().min(1),
  mensagem_externa_id: z.string().optional(),
  tipo_mensagem: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
  nome_contato: z.string().max(200).optional(),
  subscriber_id: z.string().optional().nullable(),
  origem: z.string().optional().nullable(),
});

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, "Content-Type": "application/json" },
  });
}

function derivarNomeContato(bodyNome: string | undefined, payload: Record<string, any>): string {
  const bruto =
    (bodyNome ?? "").trim() ||
    (payload.pushName ?? "").toString().trim() ||
    (payload.notifyName ?? "").toString().trim() ||
    (payload.sender?.pushName ?? "").toString().trim() ||
    (payload.contact?.name ?? "").toString().trim() ||
    "";
  const ehPlaceholder =
    !bruto ||
    /^lead\s*whatsapp$/i.test(bruto) ||
    /^paciente$/i.test(bruto) ||
    /^\+?\d[\d\s\-()]+$/.test(bruto);
  return ehPlaceholder ? "" : bruto;
}

function sanitizePayload(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    if (/token|secret|password|authorization|apikey/i.test(k)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Tenta vincular a mensagem via RPC. Retorna { ok, info } — nunca lança.
 * Em falha registra system_log SEM PII e devolve ok=false para o caller
 * decidir HTTP code.
 */
async function tentarVinculo(
  supabase: ReturnType<typeof createClient>,
  mensagemId: string,
  nomeContato: string,
  rid: string,
): Promise<{ ok: true; info: Record<string, any> } | { ok: false }> {
  const { data, error } = await supabase.rpc("vincular_mensagem_por_telefone", {
    p_mensagem_id: mensagemId,
    p_nome_contato: nomeContato || null,
  });
  if (error) {
    await supabase.from("system_logs").insert({
      level: "warn",
      category: "edge_function",
      source: "registrar-mensagem-in-n8n",
      message: "vinculo_falhou",
      details: {
        mensagem_id: mensagemId,
        request_id: rid,
        pg_code: (error as any).code ?? null,
      },
      request_id: rid,
    });
    return { ok: false };
  }
  return { ok: true, info: (data ?? {}) as Record<string, any> };
}

/**
 * Lê a decisão persistida em mensagens_whatsapp.payload.guard_decision.
 * Retorna null se ainda não foi computada ou se estrutura for inválida.
 */
async function carregarDecisaoPersistida(
  supabase: ReturnType<typeof createClient>,
  mensagemId: string,
): Promise<GuardDecision | null> {
  const { data } = await supabase
    .from("mensagens_whatsapp")
    .select("payload")
    .eq("id", mensagemId)
    .maybeSingle();
  const p = (data?.payload ?? null) as Record<string, unknown> | null;
  const g = p && typeof p === "object" ? (p as any).guard_decision : null;
  if (!g || typeof g !== "object") return null;
  // Descarta decisões de versões antigas para forçar recomputo com os
  // novos guards (rev-4: card side-effects para exame tabelado + EXAMES_HGP).
  if ((g as any).version !== 4) return null;
  return { ...EMPTY_DECISION, ...(g as Partial<GuardDecision>), version: 4 };
}

/** Merge payload.guard_decision idempotentemente. Nunca lança. */
async function persistirDecisao(
  supabase: ReturnType<typeof createClient>,
  mensagemId: string,
  decisao: GuardDecision,
): Promise<void> {
  try {
    const { data } = await supabase
      .from("mensagens_whatsapp")
      .select("payload")
      .eq("id", mensagemId)
      .maybeSingle();
    const atual = (data?.payload && typeof data.payload === "object")
      ? (data.payload as Record<string, unknown>)
      : {};
    const novo = { ...atual, guard_decision: decisao };
    await supabase.from("mensagens_whatsapp").update({ payload: novo }).eq("id", mensagemId);
  } catch (e) {
    console.warn("[registrar-mensagem-in-n8n] persistirDecisao falhou:", (e as Error).message);
  }
}

/**
 * Computa a decisão dos guards e persiste em payload.guard_decision.
 * Executa side-effects (auditoria + pausa do bot) SOMENTE quando
 * logSideEffects=true (fluxo primário). Duplicatas usam logSideEffects=false.
 */
async function computarEPersistirDecisao(params: {
  supabase: ReturnType<typeof createClient>;
  mensagemId: string;
  mensagemCreatedAt: string | null;
  conteudo: string;
  telefoneNormalizado: string;
  agendamentoId: string | null;
  providerMessageId: string | null;
  rid: string;
  logSideEffects: boolean;
}): Promise<GuardDecision> {
  const { supabase, mensagemId, mensagemCreatedAt, conteudo, telefoneNormalizado,
    agendamentoId, providerMessageId, rid, logSideEffects } = params;

  let contextoAgendamento: {
    id: string | null;
    nome_completo: string | null;
    data_nascimento: string | null;
    tipo_atendimento: string | null;
    status_crm: string | null;
    status_funil: string | null;
    estado_atendimento: string | null;
    local_atendimento: string | null;
    bot_ativo: boolean | null;
    is_sandbox: boolean | null;
  } | null = null;
  if (agendamentoId) {
    const { data: ag } = await supabase
      .from("agendamentos")
      .select("id, nome_completo, data_nascimento, tipo_atendimento, status_crm, status_funil, estado_atendimento, local_atendimento, bot_ativo, is_sandbox")
      .eq("id", agendamentoId)
      .maybeSingle();
    if (ag) contextoAgendamento = ag as typeof contextoAgendamento;
  }

  // Histórico: EXCLUI a mensagem atual via .neq(id).
  let historicoRecente: {
    id: string; direcao: string; conteudo: string; created_at: string;
  }[] = [];
  if (telefoneNormalizado) {
    const { data: msgs } = await supabase
      .from("mensagens_whatsapp")
      .select("id, direcao, conteudo, created_at")
      .eq("telefone", telefoneNormalizado)
      .neq("id", mensagemId)
      .order("created_at", { ascending: false })
      .limit(20);
    historicoRecente = ((msgs as any[]) || [])
      .reverse()
      .filter((m) => m.direcao === "IN")
      .map((m) => ({
        id: m.id, direcao: m.direcao, conteudo: m.conteudo || "", created_at: m.created_at,
      }));
  }

  const now = mensagemCreatedAt ? new Date(mensagemCreatedAt).getTime() : Date.now();
  const exames = detectarAssuntoExames(conteudo, historicoRecente, {
    now,
    currentMessageId: mensagemId,
    currentCreatedAt: mensagemCreatedAt ?? undefined,
    janelaMinutos: 45,
  });
  const precoExame = classificarExamePreco(conteudo);
  const valor = detectarValorConsulta(conteudo);

  const decisao: GuardDecision = { ...EMPTY_DECISION, computed_at: new Date().toISOString() };

  // ---- Precedência (rev-3) --------------------------------------------------
  // 1) preço de exame tabelado / pergunta genérica sem nome
  // 2) demais assuntos de exame -> handoff HGP
  // 3) valor da consulta
  // 4) agente normal
  // (urgência é tratada em camadas superiores)
  // ---------------------------------------------------------------------------

  // Rev-4: detecta se o histórico recente já tem preço tabelado, para não
  // herdar handoff genérico ao receber "sim/pode/quero..." de continuação.
  const historicoContemPrecoTabelado = (() => {
    const historicoIn = historicoRecente
      .slice(-5)
      .map((m) => (m.conteudo || "").toString())
      .filter(Boolean)
      .join(" \n ");
    return classificarExamePreco(historicoIn).kind === "preco_tabelado";
  })();

  if (precoExame.kind === "preco_tabelado") {
    const composed = composePatientReplyPrecoExame(
      precoExame.label,
      contextoAgendamento?.estado_atendimento ?? null,
      PROXIMO_DADO_POR_ESTADO,
    );
    decisao.immediate_reply = true;
    decisao.immediate_reason = "valor_exame_tabelado";
    decisao.patient_reply = composed.reply;
    decisao.resume_agent = false;

    // Rev-4: converte o card para EXAMES_HGP e mantém bot ATIVO,
    // preenchendo tipo/detalhe/local para o funil de agendamento HGP.
    const podeAlterar =
      !!contextoAgendamento &&
      isRegistroAtivo({
        is_sandbox: contextoAgendamento.is_sandbox,
        status_crm: contextoAgendamento.status_crm,
        status_funil: contextoAgendamento.status_funil,
      });
    if (logSideEffects && podeAlterar && contextoAgendamento) {
      try {
        await supabase
          .from("agendamentos")
          .update({
            status_crm: "EXAMES_HGP",
            status_funil: "exames_hgp",
            tipo_atendimento: "Exame",
            detalhe_exame_ou_cirurgia: detalheCanonicoExame(precoExame.exame),
            local_atendimento: LOCAL_HGP_CANONICO,
            bot_ativo: true,
            bot_pausado_ate: null,
            bot_pausa_motivo: null,
            motivo_status: "valor_exame_tabelado",
            bot_ultima_acao_at: new Date().toISOString(),
          })
          .eq("id", contextoAgendamento.id);
      } catch (e) {
        console.warn("[registrar-mensagem-in-n8n] update_exames_hgp falhou:", (e as Error).message);
      }
    }

    if (logSideEffects) {
      await supabase.from("system_logs").insert({
        level: "info",
        category: "whatsapp",
        source: "registrar-mensagem-in-n8n",
        message: "immediate_reply_valor_exame_tabelado",
        details: {
          request_id: rid,
          mensagem_id: mensagemId,
          provider_message_id: providerMessageId,
          exame: precoExame.exame,
          agendamento_id: contextoAgendamento?.id ?? null,
          card_convertido_para_exames_hgp: podeAlterar,
        },
        agendamento_id: contextoAgendamento?.id ?? null,
        request_id: rid,
      });
    }
  } else if (precoExame.kind === "preco_generico_sem_exame") {
    decisao.immediate_reply = true;
    decisao.immediate_reason = "exame_nao_informado";
    decisao.patient_reply = REPLY_EXAME_NAO_INFORMADO;
    decisao.resume_agent = false;
    if (logSideEffects) {
      await supabase.from("system_logs").insert({
        level: "info",
        category: "whatsapp",
        source: "registrar-mensagem-in-n8n",
        message: "immediate_reply_exame_nao_informado",
        details: {
          request_id: rid,
          mensagem_id: mensagemId,
          provider_message_id: providerMessageId,
          agendamento_id: contextoAgendamento?.id ?? null,
        },
        agendamento_id: contextoAgendamento?.id ?? null,
        request_id: rid,
      });
    }
  } else if (
    (exames.matched || precoExame.kind === "handoff_exame_nao_tabelado") &&
    // Rev-4: NÃO herda handoff quando o histórico é preço tabelado —
    // "sim/pode/quero..." deve fluir para o funil de agendamento do exame.
    !(exames.matched && exames.matchedInHistory && historicoContemPrecoTabelado)
  ) {
    const exameMencionado =
      precoExame.kind === "handoff_exame_nao_tabelado" ? precoExame.exameMencionado : null;
    const hits = exames.matched ? exames.hits : ["exame_nao_tabelado"];
    decisao.handoff_required = true;
    decisao.handoff_reason = "exame_avaliacao_hgp";
    decisao.notify_required = true;
    decisao.notification_phone = HANDOFF_NOTIFICATION_PHONE;
    decisao.patient_reply = HANDOFF_EXAMES_REPLY;
    decisao.resume_agent = false;

    const podeAlterar =
      !!contextoAgendamento &&
      isRegistroAtivo({
        is_sandbox: contextoAgendamento.is_sandbox,
        status_crm: contextoAgendamento.status_crm,
        status_funil: contextoAgendamento.status_funil,
      });

    if (logSideEffects && podeAlterar && contextoAgendamento) {
      try {
        // Rev-4: status canônico é EXAMES_HGP (não mais PRECISA_DE_HUMANO).
        await supabase
          .from("agendamentos")
          .update({
            status_crm: "EXAMES_HGP",
            status_funil: "exames_hgp",
            tipo_atendimento: "Exame",
            detalhe_exame_ou_cirurgia:
              exameMencionado ? detalheCanonicoExame(exameMencionado) : "Avaliação do pedido",
            local_atendimento: LOCAL_HGP_CANONICO,
            bot_ativo: false,
            estado_atendimento: "aguardando_humano",
            motivo_status: "exame_avaliacao_hgp",
            bot_pausa_motivo: "exame_avaliacao_hgp",
            bot_ultima_acao_at: new Date().toISOString(),
          })
          .eq("id", contextoAgendamento.id);
      } catch (e) {
        console.warn("[registrar-mensagem-in-n8n] transicao_exames_hgp falhou:", (e as Error).message);
      }
    }

    decisao.notification_summary = buildHandoffExamesSummary({
      nome: contextoAgendamento?.nome_completo ?? null,
      telefoneMascarado: maskTelefone(telefoneNormalizado),
      mensagemAtual: conteudo,
      hits,
      matchedInHistory: exames.matchedInHistory,
      agendamentoId: contextoAgendamento?.id ?? null,
      statusCrm: contextoAgendamento?.status_crm ?? null,
      statusFunil: contextoAgendamento?.status_funil ?? null,
      localAtendimento: contextoAgendamento?.local_atendimento ?? null,
      exameMencionado,
    });

    if (logSideEffects) {
      await supabase.from("system_logs").insert({
        level: "warn",
        category: "whatsapp",
        source: "registrar-mensagem-in-n8n",
        message: "handoff_exames",
        details: {
          request_id: rid,
          mensagem_id: mensagemId,
          provider_message_id: providerMessageId,
          hits,
          matched_in_history: exames.matchedInHistory,
          agendamento_id: contextoAgendamento?.id ?? null,
          pode_alterar_registro: podeAlterar,
          handoff_reason: "exame_avaliacao_hgp",
          status_crm_alvo: "EXAMES_HGP",
        },
        agendamento_id: contextoAgendamento?.id ?? null,
        request_id: rid,
      });
    }
  } else if (valor.matched) {
    const composed = composePatientReplyValor(contextoAgendamento?.estado_atendimento ?? null);
    decisao.immediate_reply = true;
    decisao.immediate_reason = valor.reason;
    decisao.patient_reply = composed.reply;
    decisao.resume_agent = false;

    if (logSideEffects) {
      await supabase.from("system_logs").insert({
        level: "info",
        category: "whatsapp",
        source: "registrar-mensagem-in-n8n",
        message: "immediate_reply_valor_consulta",
        details: {
          request_id: rid,
          mensagem_id: mensagemId,
          provider_message_id: providerMessageId,
          agendamento_id: contextoAgendamento?.id ?? null,
          estado_atendimento: contextoAgendamento?.estado_atendimento ?? null,
          retomada_aplicada: composed.hasRetomada,
        },
        agendamento_id: contextoAgendamento?.id ?? null,
        request_id: rid,
      });
    }
  }

  await persistirDecisao(supabase, mensagemId, decisao);
  return decisao;
}

/**
 * Resolve a decisão de uma mensagem duplicada.
 * - Se guard_decision já persistida: retorna sem side-effects.
 * - Se legado sem decisão: reavalia UMA vez, sem log/transição, e persiste.
 */
async function resolverDecisaoDuplicata(params: {
  supabase: ReturnType<typeof createClient>;
  mensagemId: string;
  conteudoAtual?: string | null;
  providerMessageId: string | null;
  rid: string;
}): Promise<GuardDecision> {
  const existente = await carregarDecisaoPersistida(params.supabase, params.mensagemId);
  if (existente) return existente;

  // Legado sem decisão persistida: reavaliação segura (sem log/transição).
  const { data } = await params.supabase
    .from("mensagens_whatsapp")
    .select("created_at, telefone, conteudo, agendamento_id")
    .eq("id", params.mensagemId)
    .maybeSingle();
  return computarEPersistirDecisao({
    supabase: params.supabase,
    mensagemId: params.mensagemId,
    mensagemCreatedAt: (data?.created_at as string | null) ?? null,
    conteudo: (params.conteudoAtual ?? data?.conteudo ?? "") as string,
    telefoneNormalizado: (data?.telefone as string | null) ?? "",
    agendamentoId: (data?.agendamento_id as string | null) ?? null,
    providerMessageId: params.providerMessageId,
    rid: params.rid,
    logSideEffects: false,
  });
}



serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const rid = requestId(req);
  const headers = { "x-request-id": rid };

  const guard = await requireN8nSecret(req);
  if (!guard.ok) {
    return unauthorizedResponse(guard.reason ?? "unauthorized", { ...corsHeaders, ...headers });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "invalid_json", request_id: rid }, 400, headers);
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(
      { error: "invalid_body", details: parsed.error.flatten(), request_id: rid },
      400,
      headers,
    );
  }
  const body = parsed.data;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const payloadIn = (body.payload ?? {}) as Record<string, any>;
  const nomeContato = derivarNomeContato(body.nome_contato, payloadIn);
  const providerMessageId = body.mensagem_externa_id?.trim() || null;

  // 1) Idempotência ANTES de qualquer mutação
  if (providerMessageId) {
    const { data: existente, error: dupErr } = await supabase
      .from("mensagens_whatsapp")
      .select("id, agendamento_id")
      .eq("mensagem_externa_id", providerMessageId)
      .maybeSingle();
    if (dupErr) {
      return json({ error: "lookup_failed", request_id: rid }, 500, headers);
    }
    if (existente) {
      let agendamentoId: string | null = existente.agendamento_id ?? null;
      let info: Record<string, any> = {};
      if (!agendamentoId) {
        const v = await tentarVinculo(supabase, existente.id, nomeContato, rid);
        if (!v.ok) {
          return json(
            {
              error: "vinculo_falhou",
              persisted: true,
              mensagem_id: existente.id,
              request_id: rid,
            },
            500,
            headers,
          );
        }
        info = v.info;
        agendamentoId = info.agendamento_id ?? null;
      }
      const decisao = await resolverDecisaoDuplicata({
        supabase, mensagemId: existente.id, conteudoAtual: body.conteudo,
        providerMessageId, rid,
      });
      return json(
        {
          ok: true,
          mensagem_id: existente.id,
          agendamento_id: agendamentoId,
          agendamento_encontrado: !!agendamentoId,
          ambiguo: !!info.ambiguo,
          total_matches: info.total_matches ?? null,
          duplicada: true,
          handoff_required: decisao.handoff_required,
          handoff_reason: decisao.handoff_reason,
          notify_required: decisao.notify_required,
          notification_phone: decisao.notification_phone,
          notification_summary: decisao.notification_summary,
          immediate_reply: decisao.immediate_reply,
          immediate_reason: decisao.immediate_reason,
          resume_agent: decisao.resume_agent,
          patient_reply: decisao.patient_reply,
          request_id: rid,
        },
        200,
        headers,
      );
    }
  }

  // 2) Normaliza telefone (E.164) — erro é fatal para o insert coerente
  const { data: telNorm, error: telErr } = await supabase.rpc("normalizar_telefone", {
    p_telefone: body.telefone,
  });
  if (telErr) {
    await supabase.from("system_logs").insert({
      level: "error",
      category: "edge_function",
      source: "registrar-mensagem-in-n8n",
      message: "normalizar_telefone_falhou",
      details: { request_id: rid, pg_code: (telErr as any).code ?? null },
      request_id: rid,
    });
    return json({ error: "normalizar_telefone_falhou", request_id: rid }, 500, headers);
  }
  const telefoneNormalizado =
    (typeof telNorm === "string" && telNorm.length > 0
      ? telNorm
      : body.telefone.replace(/\D/g, ""));

  // 3) Payload sanitizado
  const payloadSanit = sanitizePayload({
    ...payloadIn,
    subscriber_id: body.subscriber_id ?? payloadIn.subscriber_id ?? null,
    origem: body.origem ?? payloadIn.origem ?? "n8n_manychat",
    request_id: rid,
  });

  const insertRow: Record<string, unknown> = {
    telefone: telefoneNormalizado,
    direcao: "IN",
    conteudo: body.conteudo,
    mensagem_externa_id: providerMessageId,
    tipo_mensagem: body.tipo_mensagem ?? "whatsapp",
    status_envio: "recebida",
    provider: "manychat",
    provider_message_id: providerMessageId,
    payload: payloadSanit,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("mensagens_whatsapp")
    .insert(insertRow)
    .select("id, agendamento_id, created_at")
    .single();

  if (insErr) {
    // Race no UNIQUE (mensagem_externa_id OU provider/provider_message_id)
    if (providerMessageId && (insErr.code === "23505" || /duplicate key/i.test(insErr.message))) {
      const { data: existente } = await supabase
        .from("mensagens_whatsapp")
        .select("id, agendamento_id")
        .eq("mensagem_externa_id", providerMessageId)
        .maybeSingle();
      if (existente) {
        let agendamentoId: string | null = existente.agendamento_id ?? null;
        let info: Record<string, any> = {};
        if (!agendamentoId) {
          const v = await tentarVinculo(supabase, existente.id, nomeContato, rid);
          if (!v.ok) {
            return json(
              {
                error: "vinculo_falhou",
                persisted: true,
                mensagem_id: existente.id,
                request_id: rid,
              },
              500,
              headers,
            );
          }
          info = v.info;
          agendamentoId = info.agendamento_id ?? null;
        }
        const decisao = await resolverDecisaoDuplicata({
          supabase, mensagemId: existente.id, conteudoAtual: body.conteudo,
          providerMessageId, rid,
        });
        return json(
          {
            ok: true,
            mensagem_id: existente.id,
            agendamento_id: agendamentoId,
            agendamento_encontrado: !!agendamentoId,
            ambiguo: !!info.ambiguo,
            total_matches: info.total_matches ?? null,
            duplicada: true,
            handoff_required: decisao.handoff_required,
            handoff_reason: decisao.handoff_reason,
            notify_required: decisao.notify_required,
            notification_phone: decisao.notification_phone,
            notification_summary: decisao.notification_summary,
            immediate_reply: decisao.immediate_reply,
            immediate_reason: decisao.immediate_reason,
            resume_agent: decisao.resume_agent,
            patient_reply: decisao.patient_reply,
            request_id: rid,
          },
          200,
          headers,
        );
      }
    }
    await supabase.from("system_logs").insert({
      level: "error",
      category: "edge_function",
      source: "registrar-mensagem-in-n8n",
      message: "insert_in_falhou",
      details: {
        request_id: rid,
        telefone_mask: maskTelefone(telefoneNormalizado),
        has_provider_msg_id: !!providerMessageId,
        pg_code: (insErr as any).code ?? null,
      },
      request_id: rid,
    });
    return json({ error: "insert_in_falhou", request_id: rid }, 500, headers);
  }

  // 4) Vinculação determinística via RPC.
  //    Falha aqui → mensagem já foi persistida; devolvemos 500 com persisted=true
  //    e mensagem_id para o n8n retentar idempotentemente.
  const v = await tentarVinculo(supabase, inserted.id, nomeContato, rid);
  if (!v.ok) {
    return json(
      {
        error: "vinculo_falhou",
        persisted: true,
        mensagem_id: inserted.id,
        request_id: rid,
      },
      500,
      headers,
    );
  }
  const info = v.info;
  const agendamentoId = info.agendamento_id ?? null;

  // 5) Backfill de nome quando placeholder
  if (agendamentoId && !info.criado && nomeContato.length > 1) {
    const { data: atual } = await supabase
      .from("agendamentos")
      .select("nome_completo")
      .eq("id", agendamentoId)
      .maybeSingle();
    const nomeAtual = (atual?.nome_completo ?? "").trim();
    const ehPlaceholder =
      !nomeAtual ||
      /^lead\s*whatsapp$/i.test(nomeAtual) ||
      /^paciente$/i.test(nomeAtual);
    if (ehPlaceholder) {
      await supabase
        .from("agendamentos")
        .update({ nome_completo: nomeContato })
        .eq("id", agendamentoId);
    }
  }

  // ==========================================================================
  // 6) GUARDS DETERMINÍSTICOS via helper (executa side-effects e persiste
  //    guard_decision em mensagens_whatsapp.payload).
  // ==========================================================================
  const decisao = await computarEPersistirDecisao({
    supabase,
    mensagemId: inserted.id,
    mensagemCreatedAt: (inserted as any).created_at ?? null,
    conteudo: body.conteudo,
    telefoneNormalizado,
    agendamentoId,
    providerMessageId,
    rid,
    logSideEffects: true,
  });

  return json(
    {
      ok: true,
      mensagem_id: inserted.id,
      agendamento_id: agendamentoId,
      agendamento_encontrado: !!agendamentoId,
      lead_criado: !!info.criado,
      ambiguo: !!info.ambiguo,
      total_matches: info.total_matches ?? null,
      duplicada: false,
      handoff_required: decisao.handoff_required,
      handoff_reason: decisao.handoff_reason,
      notify_required: decisao.notify_required,
      notification_phone: decisao.notification_phone,
      notification_summary: decisao.notification_summary,
      immediate_reply: decisao.immediate_reply,
      immediate_reason: decisao.immediate_reason,
      resume_agent: decisao.resume_agent,
      patient_reply: decisao.patient_reply,
      request_id: rid,
    },
    200,
    headers,
  );
});

