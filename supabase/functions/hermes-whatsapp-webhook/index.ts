// Endpoint seguro para o Hermes Agent enviar eventos de WhatsApp normalizados
// Autentica via header X-Hermes-Secret. Não depende de sessão admin.
//
// Fluxo:
// 1. Valida header secreto + payload (zod)
// 2. Ignora from_me=true
// 3. Deduplica por external_message_id
// 4. Normaliza telefone, encontra/cria lead
// 5. Salva mensagem IN no histórico via RPC registrar_mensagem_whatsapp
// 6. Classifica intenção (keywords + heurística)
// 7. Detecta urgência médica → handoff humano
// 8. Para "agendar": consulta listar-datas-disponiveis e devolve opções agrupadas
// 9. Confirmação numérica → cria agendamento via converter-lead-agendamento
// 10. Retorna { reply_text, actions, intent, lead_id, needs_human, conversation_state }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { registrarMensagemWhatsapp } from "../_shared/registrarMensagem.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hermes-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ----- Schema -----
const payloadSchema = z.object({
  source: z.string().optional().default("evolution"),
  instance: z.string().optional(),
  event: z.string().optional(),
  phone: z.string().min(8),
  remote_jid: z.string().optional(),
  direction: z.enum(["IN", "OUT"]).optional().default("IN"),
  from_me: z.boolean().optional().default(false),
  message_type: z
    .enum(["text", "audio", "image", "video", "document", "sticker", "reaction", "media"])
    .optional()
    .default("text"),
  text: z.string().optional().default(""),
  external_message_id: z.string().optional().nullable(),
  timestamp: z.string().optional(),
  raw_payload: z.record(z.any()).optional().nullable(),
});

type Payload = z.infer<typeof payloadSchema>;

// ----- Utils -----
const normalizePhone = (p: string) => (p || "").replace(/\D/g, "");
const last8 = (p: string) => normalizePhone(p).slice(-8);

const URGENCY_KEYWORDS = [
  "perdi a visão", "perda de visao", "perda da visao", "perda visao",
  "não enxergo", "nao enxergo", "fiquei cego", "cegueira súbita",
  "trauma ocular", "machuquei o olho", "bati o olho", "produto químico",
  "queimadura", "sangrando", "muita dor", "dor muito forte", "dor insuportável",
  "urgência", "urgencia", "emergência", "emergencia", "socorro",
  "flashes de luz", "moscas volantes súbitas", "cortina preta",
];

const INTENT_RULES: Array<{ intent: string; kw: string[] }> = [
  { intent: "cancelar", kw: ["cancelar", "desmarcar", "não posso ir", "nao posso ir", "não vou conseguir", "nao vou"] },
  { intent: "remarcar", kw: ["remarcar", "trocar horário", "trocar horario", "mudar dia", "mudar horario", "outra data"] },
  { intent: "confirmar", kw: ["confirmar", "confirmo", "estou confirmado", "vou comparecer", "vou sim"] },
  { intent: "endereco", kw: ["endereço", "endereco", "onde fica", "localização", "localizacao", "como chegar"] },
  { intent: "convenio_valor", kw: ["convênio", "convenio", "valor", "preço", "preco", "quanto custa", "particular"] },
  { intent: "humano", kw: ["atendente", "humano", "pessoa", "secretária", "secretaria", "falar com alguém", "falar com alguem"] },
  { intent: "agendar", kw: ["agendar", "marcar", "consulta", "horário", "horario", "atendimento"] },
];

function classifyIntent(text: string): string {
  const t = (text || "").toLowerCase().trim();
  if (!t) return "ambiguo";
  if (URGENCY_KEYWORDS.some((k) => t.includes(k))) return "urgencia";
  for (const r of INTENT_RULES) {
    if (r.kw.some((k) => t.includes(k))) return r.intent;
  }
  // saudação simples
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|hi|hello)\b/.test(t)) return "saudacao";
  // possível resposta numérica (escolha de opção)
  if (/^\s*\d{1,2}\s*$/.test(t)) return "escolha_opcao";
  return "ambiguo";
}

function periodoFromHora(hora: string): "manhã" | "tarde" | "noite" {
  const h = parseInt(hora.slice(0, 2), 10);
  if (h < 12) return "manhã";
  if (h < 18) return "tarde";
  return "noite";
}

function fmtDataBR(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}/${m}`;
}

// ----- Conversation state (in-memory por cold start; suficiente para conversas curtas) -----
interface ConvState {
  last_intent: string;
  ambiguous_count: number;
  last_options?: Array<{
    n: number;
    data: string;
    periodo: string;
    local: string;
  }>;
  awaiting?: "escolha_periodo" | "escolha_horario" | null;
  selected_data?: string;
  selected_periodo?: string;
  selected_local?: string;
  available_slots?: string[]; // horários do periodo selecionado
  updated_at: number;
}
const convStore = new Map<string, ConvState>();
const CONV_TTL_MS = 30 * 60 * 1000;
function getState(phone: string): ConvState {
  const k = normalizePhone(phone);
  const s = convStore.get(k);
  if (s && Date.now() - s.updated_at < CONV_TTL_MS) return s;
  const fresh: ConvState = { last_intent: "", ambiguous_count: 0, updated_at: Date.now() };
  convStore.set(k, fresh);
  return fresh;
}
function saveState(phone: string, s: ConvState) {
  s.updated_at = Date.now();
  convStore.set(normalizePhone(phone), s);
}

// ----- Lead lookup / creation -----
async function findOrCreateLead(
  supabase: ReturnType<typeof createClient>,
  phone: string,
): Promise<{ id: string; created: boolean; status_funil: string | null }> {
  const norm = normalizePhone(phone);
  const l8 = last8(norm);

  // Busca último lead/agendamento por últimos 8 dígitos
  const { data: existing } = await supabase
    .from("agendamentos")
    .select("id, status_funil, is_sandbox, data_agendamento, created_at")
    .filter("telefone_whatsapp", "ilike", `%${l8}`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) {
    return { id: existing[0].id as string, created: false, status_funil: (existing[0].status_funil as string) ?? null };
  }

  const { data: created, error } = await supabase
    .from("agendamentos")
    .insert({
      nome_completo: "Lead WhatsApp",
      telefone_whatsapp: norm,
      tipo_atendimento: "Consulta",
      local_atendimento: "A definir",
      convenio: "Particular",
      origem: "whatsapp_hermes",
      status_crm: "NOVO LEAD",
      status_funil: "lead",
    })
    .select("id, status_funil")
    .single();

  if (error) {
    throw new Error(`Falha ao criar lead: ${error.message}`);
  }
  return { id: created.id as string, created: true, status_funil: created.status_funil as string };
}

// ----- Disponibilidade (próximos N dias agrupados em opções) -----
async function buscarOpcoesAgrupadas(
  supabaseUrl: string,
  serviceKey: string,
): Promise<Array<{ n: number; data: string; periodo: string; local: string }>> {
  // Busca o mês corrente e próximo, todos os locais (sem filtrar)
  const hoje = new Date();
  const meses = [
    { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() },
    {
      mes: hoje.getMonth() + 2 > 12 ? 1 : hoje.getMonth() + 2,
      ano: hoje.getMonth() + 2 > 12 ? hoje.getFullYear() + 1 : hoje.getFullYear(),
    },
  ];

  const locais = ["Clinicor – Paragominas", "Hospital Geral de Paragominas"];
  const opcoes: Array<{ data: string; periodo: string; local: string }> = [];

  for (const local of locais) {
    for (const m of meses) {
      const resp = await fetch(`${supabaseUrl}/functions/v1/listar-datas-disponiveis`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ mes: m.mes, ano: m.ano, local_atendimento: local }),
      });
      if (!resp.ok) continue;
      const json = await resp.json();
      const datas: Array<{ data: string }> = json?.datas_disponiveis ?? [];
      for (const d of datas.slice(0, 4)) {
        // Buscar 1-2 horários para inferir período (manhã/tarde)
        const r2 = await fetch(`${supabaseUrl}/functions/v1/listar-horarios-disponiveis`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ data: d.data, local_atendimento: local }),
        });
        if (!r2.ok) continue;
        const j2 = await r2.json();
        const horarios: string[] = (j2?.horarios_disponiveis ?? []).map((h: any) =>
          typeof h === "string" ? h : h?.hora ?? "",
        ).filter(Boolean);
        const periodos = new Set<string>();
        for (const h of horarios) periodos.add(periodoFromHora(h));
        for (const p of periodos) {
          opcoes.push({ data: d.data, periodo: p, local });
        }
      }
    }
  }

  // Ordena por data e limita a 6 opções
  opcoes.sort((a, b) => a.data.localeCompare(b.data));
  const dedup: typeof opcoes = [];
  const seen = new Set<string>();
  for (const o of opcoes) {
    const k = `${o.data}|${o.periodo}|${o.local}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(o);
    if (dedup.length >= 6) break;
  }
  return dedup.map((o, i) => ({ n: i + 1, ...o }));
}

async function buscarHorariosDoPeriodo(
  supabaseUrl: string,
  serviceKey: string,
  data: string,
  local: string,
  periodo: string,
): Promise<string[]> {
  const resp = await fetch(`${supabaseUrl}/functions/v1/listar-horarios-disponiveis`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ data, local_atendimento: local }),
  });
  if (!resp.ok) return [];
  const j = await resp.json();
  const horarios: string[] = (j?.horarios_disponiveis ?? []).map((h: any) =>
    typeof h === "string" ? h : h?.hora ?? "",
  ).filter(Boolean);
  return horarios.filter((h) => periodoFromHora(h) === periodo).slice(0, 4);
}

// ----- Texto das respostas -----
function montarTextoOpcoes(opcoes: Array<{ n: number; data: string; periodo: string; local: string }>): string {
  if (opcoes.length === 0) {
    return "No momento não tenho horários disponíveis. Vou te encaminhar para nossa equipe humana, ok? 🙏";
  }
  const linhas = opcoes.map(
    (o) => `${o.n}) ${fmtDataBR(o.data)} — ${o.periodo} — ${o.local.includes("Clinicor") ? "Clinicor" : "HGP"}`,
  );
  return [
    "Tenho estas opções para sua consulta com o Dr. Juliano:",
    "",
    ...linhas,
    "",
    "Responda com o número da opção que prefere. 😊",
  ].join("\n");
}

// ----- Handler principal -----
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Auth
  const expectedSecret = Deno.env.get("HERMES_WEBHOOK_SECRET");
  const headerSecret = req.headers.get("x-hermes-secret");
  if (!expectedSecret) {
    console.error("[hermes-webhook] HERMES_WEBHOOK_SECRET não configurado");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!headerSecret || headerSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Parse + validate
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Invalid payload", details: parsed.error.flatten() }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const p: Payload = parsed.data;

  // 3. Ignore from_me
  if (p.from_me === true || p.direction === "OUT") {
    return new Response(JSON.stringify({ ok: true, ignored: "from_me" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // 4. Dedupe por external_message_id
  if (p.external_message_id) {
    const { data: dup } = await supabase
      .from("mensagens_whatsapp")
      .select("id")
      .eq("mensagem_externa_id", p.external_message_id)
      .limit(1)
      .maybeSingle();
    if (dup) {
      return new Response(JSON.stringify({ ok: true, deduped: true, message_id: dup.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const phoneNorm = normalizePhone(p.phone);

  try {
    // 5. Lead
    const lead = await findOrCreateLead(supabase, phoneNorm);

    // 6. Texto efetivo (transcrição se mídia)
    const isMedia = ["audio", "image", "video", "document", "sticker", "media"].includes(p.message_type);
    const effectiveText = (p.text || "").trim();

    // 7. Salvar mensagem recebida
    const tipoMsg =
      p.message_type === "text"
        ? "recebida"
        : (["audio", "image", "video", "document", "sticker", "reaction"] as const).includes(
            p.message_type as any,
          )
        ? (p.message_type as any)
        : "recebida";

    await registrarMensagemWhatsapp(supabase, {
      telefone: phoneNorm,
      direcao: "IN",
      conteudo: effectiveText || `[${p.message_type}]`,
      tipo_mensagem: tipoMsg,
      agendamento_id: lead.id,
      status_envio: "entregue",
      mensagem_externa_id: p.external_message_id ?? null,
      payload: (p.raw_payload as Record<string, unknown>) ?? { event: p.event, instance: p.instance },
    });

    // 8. Mídia sem transcrição
    if (isMedia && !effectiveText) {
      return new Response(
        JSON.stringify({
          ok: true,
          lead_id: lead.id,
          intent: "midia_sem_transcricao",
          needs_human: false,
          actions: ["request_transcription"],
          reply_text:
            "Recebi seu áudio/imagem 🙏 Pode me escrever em texto o que você precisa? Assim consigo te ajudar mais rápido.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 9. Classificar intenção
    const intent = classifyIntent(effectiveText);
    const state = getState(phoneNorm);

    // 10. Urgência → handoff
    if (intent === "urgencia") {
      await supabase
        .from("agendamentos")
        .update({ status_crm: "URGENTE", bot_ativo: false })
        .eq("id", lead.id);
      saveState(phoneNorm, { ...state, last_intent: intent, ambiguous_count: 0 });
      return new Response(
        JSON.stringify({
          ok: true,
          lead_id: lead.id,
          intent,
          needs_human: true,
          actions: ["handoff_human", "mark_urgent"],
          reply_text:
            "Entendi que é uma situação urgente 🙏 Por segurança, **não posso avaliar sintomas por aqui**. Estou chamando agora nossa equipe humana para te orientar. Se houver perda súbita de visão, dor intensa ou trauma ocular, procure imediatamente o pronto-socorro oftalmológico mais próximo.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 11. Pedido humano
    if (intent === "humano") {
      await supabase.from("agendamentos").update({ bot_ativo: false }).eq("id", lead.id);
      return new Response(
        JSON.stringify({
          ok: true,
          lead_id: lead.id,
          intent,
          needs_human: true,
          actions: ["handoff_human"],
          reply_text: "Claro! Vou te transferir para nossa equipe humana agora mesmo. Aguarde só um instante 🙏",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 12. Cancelar / remarcar / confirmar / endereço / convênio → handoff humano (mais seguro)
    if (["cancelar", "remarcar", "confirmar", "endereco", "convenio_valor"].includes(intent)) {
      const replies: Record<string, string> = {
        cancelar:
          "Sem problema, vou pedir para nossa equipe te ajudar com o cancelamento. Em instantes alguém te chama por aqui 🙏",
        remarcar:
          "Posso te ajudar a remarcar! Vou te passar para nossa equipe que vai sugerir novos horários disponíveis 🙏",
        confirmar:
          "Perfeito! Vou registrar sua confirmação e nossa equipe te confirma os detalhes finais em instantes ✅",
        endereco:
          "Nossos endereços:\n• *Clinicor* — Av. Pres. Vargas, 760, Centro, Paragominas\n• *HGP* — Hospital Geral de Paragominas\n\nQuer que eu te ajude a agendar?",
        convenio_valor:
          "Atendemos *Particular*, *Bradesco*, *Unimed*, *Cassi* e *Sul América*. Para valores e convênios específicos, vou te passar para nossa equipe 🙏",
      };
      const needsHuman = !["endereco"].includes(intent);
      if (needsHuman) {
        await supabase.from("agendamentos").update({ bot_ativo: false }).eq("id", lead.id);
      }
      return new Response(
        JSON.stringify({
          ok: true,
          lead_id: lead.id,
          intent,
          needs_human: needsHuman,
          actions: needsHuman ? ["handoff_human"] : [],
          reply_text: replies[intent],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 13. Escolha numérica de opção previamente enviada
    if (intent === "escolha_opcao" && state.last_options && state.last_options.length > 0) {
      const num = parseInt(effectiveText, 10);
      const escolhida = state.last_options.find((o) => o.n === num);
      if (!escolhida) {
        return new Response(
          JSON.stringify({
            ok: true,
            lead_id: lead.id,
            intent: "opcao_invalida",
            needs_human: false,
            reply_text: `Não encontrei a opção ${num}. Pode me dizer o número que aparece antes do horário? 😊`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Buscar horários do período
      const horarios = await buscarHorariosDoPeriodo(
        supabaseUrl,
        serviceKey,
        escolhida.data,
        escolhida.local,
        escolhida.periodo,
      );
      if (horarios.length === 0) {
        return new Response(
          JSON.stringify({
            ok: true,
            lead_id: lead.id,
            intent: "sem_horarios",
            needs_human: true,
            actions: ["handoff_human"],
            reply_text:
              "Esse período acabou de ficar lotado 😕 Vou te passar para nossa equipe escolher outra data com você.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      saveState(phoneNorm, {
        ...state,
        last_intent: "escolha_opcao",
        ambiguous_count: 0,
        awaiting: "escolha_horario",
        selected_data: escolhida.data,
        selected_periodo: escolhida.periodo,
        selected_local: escolhida.local,
        available_slots: horarios,
      });

      const linhas = horarios.map((h, i) => `${i + 1}) ${h.slice(0, 5)}`);
      return new Response(
        JSON.stringify({
          ok: true,
          lead_id: lead.id,
          intent: "selecionar_horario",
          needs_human: false,
          actions: ["await_time_selection"],
          reply_text: [
            `Ótimo! ${fmtDataBR(escolhida.data)} no período da ${escolhida.periodo} no ${escolhida.local.includes("Clinicor") ? "Clinicor" : "HGP"}.`,
            "",
            "Tenho estes horários:",
            ...linhas,
            "",
            "Qual prefere? Responda com o número.",
          ].join("\n"),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 14. Escolha de horário (passo 2)
    if (
      state.awaiting === "escolha_horario" &&
      state.available_slots &&
      /^\s*\d{1,2}\s*$/.test(effectiveText)
    ) {
      const idx = parseInt(effectiveText, 10) - 1;
      const horario = state.available_slots[idx];
      if (!horario) {
        return new Response(
          JSON.stringify({
            ok: true,
            lead_id: lead.id,
            intent: "horario_invalido",
            needs_human: false,
            reply_text: "Não encontrei esse número. Pode me responder com o número correspondente ao horário? 😊",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Cria agendamento via converter-lead-agendamento
      const convResp = await fetch(`${supabaseUrl}/functions/v1/converter-lead-agendamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({
          lead_id: lead.id,
          data_agendamento: state.selected_data,
          hora_agendamento: horario.slice(0, 5),
          local_atendimento: state.selected_local,
          aceita_primeiro_horario: true,
          aceita_contato_whatsapp_email: true,
        }),
      });
      const convJson = await convResp.json().catch(() => ({}));

      if (!convResp.ok || convJson?.error) {
        return new Response(
          JSON.stringify({
            ok: true,
            lead_id: lead.id,
            intent: "agendamento_falhou",
            needs_human: true,
            actions: ["handoff_human"],
            reply_text:
              "Tive um probleminha para confirmar esse horário 😕 Vou te passar para nossa equipe finalizar o agendamento.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      saveState(phoneNorm, {
        last_intent: "agendado",
        ambiguous_count: 0,
        awaiting: null,
        updated_at: Date.now(),
      });

      return new Response(
        JSON.stringify({
          ok: true,
          lead_id: lead.id,
          intent: "agendamento_criado",
          needs_human: false,
          actions: ["appointment_created"],
          appointment: {
            data: state.selected_data,
            hora: horario.slice(0, 5),
            local: state.selected_local,
          },
          reply_text: [
            `✅ Pronto! Sua consulta está agendada:`,
            ``,
            `📅 ${fmtDataBR(state.selected_data!)} às ${horario.slice(0, 5)}`,
            `📍 ${state.selected_local}`,
            ``,
            `Em breve nossa equipe entra em contato para confirmar tudo. Qualquer coisa, é só me chamar 🙏`,
          ].join("\n"),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 15. Agendar / saudação → mostrar opções
    if (intent === "agendar" || intent === "saudacao") {
      const opcoes = await buscarOpcoesAgrupadas(supabaseUrl, serviceKey);
      saveState(phoneNorm, {
        ...state,
        last_intent: "agendar",
        ambiguous_count: 0,
        awaiting: "escolha_periodo",
        last_options: opcoes,
      });
      const greeting =
        intent === "saudacao"
          ? "Olá! Sou a assistente do Dr. Juliano Machado, oftalmologista 👋\n\n"
          : "";
      return new Response(
        JSON.stringify({
          ok: true,
          lead_id: lead.id,
          intent: "oferecer_opcoes",
          needs_human: false,
          actions: ["await_option_selection"],
          options: opcoes,
          reply_text: greeting + montarTextoOpcoes(opcoes),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 16. Ambíguo
    const ambig = (state.ambiguous_count ?? 0) + 1;
    saveState(phoneNorm, { ...state, last_intent: "ambiguo", ambiguous_count: ambig });
    if (ambig >= 3) {
      await supabase.from("agendamentos").update({ bot_ativo: false }).eq("id", lead.id);
      return new Response(
        JSON.stringify({
          ok: true,
          lead_id: lead.id,
          intent: "ambiguo",
          needs_human: true,
          actions: ["handoff_human"],
          reply_text:
            "Acho melhor nossa equipe humana te atender pra entender direitinho 🙏 Já estou chamando alguém aqui.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        lead_id: lead.id,
        intent: "ambiguo",
        needs_human: false,
        reply_text:
          "Não entendi muito bem 😅 Posso te ajudar com:\n• *Agendar* uma consulta\n• Tirar dúvida sobre *endereço*\n• Falar com nossa *equipe humana*\n\nO que você precisa?",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[hermes-webhook] erro:", err);
    return new Response(
      JSON.stringify({
        error: "Internal error",
        message: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
