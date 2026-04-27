// Endpoint seguro para o Hermes Agent enviar eventos de WhatsApp normalizados.
// Autentica via header X-Hermes-Secret. Não depende de sessão admin.
// Não envia WhatsApp diretamente — apenas devolve `reply_text` para o Hermes enviar via Evolution.
//
// Resposta padrão:
// {
//   ok, lead_id, action ("reply" | "none"), reply_text, crm_status,
//   intent, needs_human, appointment_created, appointment
// }
//
// Modo sandbox: ativo se telefone terminar com 0174 OU se payload trouxer `sandbox: true`.
// Em produção (sandbox=false), o bot apenas registra a mensagem e pede humano (não cria agendamento real).

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
  sandbox: z.boolean().optional(),
});

type Payload = z.infer<typeof payloadSchema>;

// ----- Helpers de resposta padronizada -----
interface StdResponse {
  ok: boolean;
  lead_id?: string | null;
  action: "reply" | "none";
  reply_text: string | null;
  crm_status?: string | null;
  intent?: string;
  needs_human?: boolean;
  appointment_created?: boolean;
  appointment?: { date: string; time: string; location: string } | null;
  error?: string;
  sandbox?: boolean;
  deduped?: boolean;
}

function jsonResp(body: StdResponse, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ----- Utils -----
const normalizePhone = (p: string) => (p || "").replace(/\D/g, "");
const last8 = (p: string) => normalizePhone(p).slice(-8);
const isSandboxPhone = (p: string) => normalizePhone(p).endsWith("0174");

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
  { intent: "confirmar_agendamento", kw: ["confirmar", "confirmo", "estou confirmado", "vou comparecer", "vou sim"] },
  { intent: "endereco", kw: ["endereço", "endereco", "onde fica", "localização", "localizacao", "como chegar"] },
  { intent: "convenio_valor", kw: ["convênio", "convenio", "valor", "preço", "preco", "quanto custa", "particular"] },
  { intent: "humano", kw: ["atendente", "humano", "pessoa", "secretária", "secretaria", "falar com alguém", "falar com alguem"] },
  { intent: "agendar_consulta", kw: ["agendar", "marcar", "consulta", "horário", "horario", "atendimento"] },
];

function classifyIntent(text: string): string {
  const t = (text || "").toLowerCase().trim();
  if (!t) return "ambiguo";
  if (URGENCY_KEYWORDS.some((k) => t.includes(k))) return "urgencia";
  for (const r of INTENT_RULES) {
    if (r.kw.some((k) => t.includes(k))) return r.intent;
  }
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|hi|hello)\b/.test(t)) return "saudacao";
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
  return `${d}/${m}/${y}`;
}

function crmStatusFromLocal(local: string): string {
  if (local.toLowerCase().includes("clinicor")) return "CLINICOR";
  if (local.toLowerCase().includes("hgp") || local.toLowerCase().includes("hospital geral")) return "HGP";
  return "AGENDADO";
}

// ----- Conversation state (in-memory por instância; suficiente para conversas curtas) -----
interface ConvState {
  last_intent: string;
  ambiguous_count: number;
  last_options?: Array<{ n: number; data: string; periodo: string; local: string }>;
  awaiting?: "escolha_periodo" | "escolha_horario" | null;
  selected_data?: string;
  selected_periodo?: string;
  selected_local?: string;
  available_slots?: string[];
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
  sandbox: boolean,
): Promise<{ id: string; created: boolean; status_crm: string | null; status_funil: string | null }> {
  const norm = normalizePhone(phone);
  const l8 = last8(norm);

  const { data: existing } = await supabase
    .from("agendamentos")
    .select("id, status_crm, status_funil, is_sandbox, data_agendamento, created_at")
    .filter("telefone_whatsapp", "ilike", `%${l8}`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) {
    return {
      id: existing[0].id as string,
      created: false,
      status_crm: (existing[0].status_crm as string) ?? null,
      status_funil: (existing[0].status_funil as string) ?? null,
    };
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
      is_sandbox: sandbox,
      sandbox_reason: sandbox ? "Hermes webhook (telefone teste 0174 ou sandbox=true)" : null,
    })
    .select("id, status_crm, status_funil")
    .single();

  if (error) throw new Error(`Falha ao criar lead: ${error.message}`);
  return {
    id: created.id as string,
    created: true,
    status_crm: created.status_crm as string,
    status_funil: created.status_funil as string,
  };
}

// ----- Auditoria CRM (origem Hermes/Evolution) -----
async function logHermes(
  supabase: ReturnType<typeof createClient>,
  agendamentoId: string | null,
  acao: string,
  intent: string,
  detalhes: Record<string, unknown>,
) {
  try {
    await supabase.from("system_logs").insert({
      level: "info",
      category: "whatsapp",
      source: "hermes-webhook",
      message: `${acao} · ${intent}`,
      details: detalhes,
      agendamento_id: agendamentoId,
    });
  } catch (_) { /* best-effort */ }
}

// ----- Salvar mensagem OUT (resposta do bot) -----
async function salvarOutbound(
  supabase: ReturnType<typeof createClient>,
  phoneNorm: string,
  agendamentoId: string,
  texto: string,
  intent: string,
) {
  await registrarMensagemWhatsapp(supabase, {
    telefone: phoneNorm,
    direcao: "OUT",
    conteudo: texto,
    tipo_mensagem: "resposta_automatica",
    agendamento_id: agendamentoId,
    status_envio: "preparado_hermes",
    payload: { source: "hermes-webhook", intent },
  });
}

// ----- Disponibilidade (próximos N dias agrupados em opções) -----
async function buscarOpcoesAgrupadas(
  supabaseUrl: string,
  serviceKey: string,
): Promise<Array<{ n: number; data: string; periodo: string; local: string }>> {
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
        for (const p of periodos) opcoes.push({ data: d.data, periodo: p, local });
      }
    }
  }

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
  return horarios.filter((h) => periodoFromHora(h) === periodo);
}

// ----- Texto das respostas -----
function montarTextoOpcoes(opcoes: Array<{ n: number; data: string; periodo: string; local: string }>): string {
  if (opcoes.length === 0) {
    return "No momento não tenho horários disponíveis. Vou te encaminhar para nossa equipe humana, ok? 🙏";
  }
  const linhas = opcoes.map(
    (o) => `${o.n}) ${fmtDataBR(o.data).slice(0, 5)} — ${o.periodo} — ${o.local.includes("Clinicor") ? "Clinicor" : "HGP"}`,
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResp({ ok: false, action: "none", reply_text: null, error: "Method not allowed" }, 405);
  }

  // 1. Auth
  const expectedSecret = Deno.env.get("HERMES_WEBHOOK_SECRET");
  const headerSecret = req.headers.get("x-hermes-secret");
  if (!expectedSecret) {
    console.error("[hermes-webhook] HERMES_WEBHOOK_SECRET não configurado");
    return jsonResp({ ok: false, action: "none", reply_text: null, error: "Server misconfigured" }, 500);
  }
  if (!headerSecret || headerSecret !== expectedSecret) {
    return jsonResp({ ok: false, action: "none", reply_text: null, error: "Unauthorized" }, 401);
  }

  // 2. Parse + validate
  let raw: unknown;
  try { raw = await req.json(); } catch {
    return jsonResp({ ok: false, action: "none", reply_text: null, error: "Invalid JSON" }, 400);
  }
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResp({ ok: false, action: "none", reply_text: null, error: "Invalid payload" }, 400);
  }
  const p: Payload = parsed.data;

  // 3. Ignore from_me
  if (p.from_me === true || p.direction === "OUT") {
    return jsonResp({ ok: true, action: "none", reply_text: null });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const phoneNorm = normalizePhone(p.phone);
  const sandbox = !!p.sandbox || isSandboxPhone(phoneNorm);

  // 4. Dedupe
  if (p.external_message_id) {
    const { data: dup } = await supabase
      .from("mensagens_whatsapp")
      .select("id")
      .eq("mensagem_externa_id", p.external_message_id)
      .limit(1)
      .maybeSingle();
    if (dup) {
      return jsonResp({ ok: true, action: "none", reply_text: null, deduped: true });
    }
  }

  try {
    // 5. Lead
    const lead = await findOrCreateLead(supabase, phoneNorm, sandbox);

    // 6. Texto efetivo
    const isMedia = ["audio", "image", "video", "document", "sticker", "media"].includes(p.message_type);
    const effectiveText = (p.text || "").trim();

    // 7. Salvar mensagem IN
    const tipoMsg =
      p.message_type === "text"
        ? "recebida"
        : (["audio", "image", "video", "document", "sticker", "reaction"] as const).includes(p.message_type as any)
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
      payload: (p.raw_payload as Record<string, unknown>) ?? { event: p.event, instance: p.instance, source: "hermes" },
    });

    // ----- Helper para responder + salvar OUT + log -----
    const replyAndLog = async (
      reply: string,
      intent: string,
      extras: Partial<StdResponse> = {},
    ) => {
      await salvarOutbound(supabase, phoneNorm, lead.id, reply, intent);
      await logHermes(supabase, lead.id, "reply", intent, { sandbox, ...extras });
      return jsonResp({
        ok: true,
        lead_id: lead.id,
        action: "reply",
        reply_text: reply,
        crm_status: extras.crm_status ?? lead.status_crm ?? "NOVO LEAD",
        intent,
        needs_human: extras.needs_human ?? false,
        appointment_created: extras.appointment_created ?? false,
        appointment: extras.appointment ?? null,
        sandbox,
      });
    };

    // 8. Mídia sem transcrição
    if (isMedia && !effectiveText) {
      return replyAndLog(
        "Recebi seu áudio/imagem 🙏 Pode me escrever em texto o que você precisa? Assim consigo te ajudar mais rápido.",
        "midia_sem_transcricao",
      );
    }

    // 9. Classificar
    const intent = classifyIntent(effectiveText);
    const state = getState(phoneNorm);

    // 10. Urgência
    if (intent === "urgencia") {
      await supabase
        .from("agendamentos")
        .update({ status_crm: "URGENTE", bot_ativo: false })
        .eq("id", lead.id);
      saveState(phoneNorm, { ...state, last_intent: intent, ambiguous_count: 0 });
      return replyAndLog(
        "Entendi que é uma situação urgente 🙏 Por segurança, *não posso avaliar sintomas por aqui*. Estou chamando agora nossa equipe humana para te orientar. Se houver perda súbita de visão, dor intensa ou trauma ocular, procure imediatamente o pronto-socorro oftalmológico mais próximo.",
        "urgencia",
        { needs_human: true, crm_status: "URGENTE" },
      );
    }

    // 11. Pedido de humano
    if (intent === "humano") {
      await supabase.from("agendamentos").update({ status_crm: "PRECISA_DE_HUMANO", bot_ativo: false }).eq("id", lead.id);
      return replyAndLog(
        "Claro! Vou te transferir para nossa equipe humana agora mesmo. Aguarde só um instante 🙏",
        "humano",
        { needs_human: true, crm_status: "PRECISA_DE_HUMANO" },
      );
    }

    // 12. Cancelar / remarcar / confirmar prévio / endereço / convênio
    if (["cancelar", "remarcar", "confirmar_agendamento", "endereco", "convenio_valor"].includes(intent)) {
      const replies: Record<string, string> = {
        cancelar: "Sem problema, vou pedir para nossa equipe te ajudar com o cancelamento. Em instantes alguém te chama por aqui 🙏",
        remarcar: "Posso te ajudar a remarcar! Vou te passar para nossa equipe que vai sugerir novos horários disponíveis 🙏",
        confirmar_agendamento: "Perfeito! Vou registrar sua confirmação e nossa equipe te confirma os detalhes finais em instantes ✅",
        endereco: "Nossos endereços:\n• *Clinicor* — Av. Pres. Vargas, 760, Centro, Paragominas\n• *HGP* — Hospital Geral de Paragominas\n\nQuer que eu te ajude a agendar?",
        convenio_valor: "Atendemos *Particular*, *Bradesco*, *Unimed*, *Cassi* e *Sul América*. Para valores e convênios específicos, vou te passar para nossa equipe 🙏",
      };
      const needsHuman = intent !== "endereco";
      let crmStatus = lead.status_crm ?? "NOVO LEAD";
      if (needsHuman) {
        crmStatus = "PRECISA_DE_HUMANO";
        await supabase.from("agendamentos").update({ status_crm: crmStatus, bot_ativo: false }).eq("id", lead.id);
      }
      return replyAndLog(replies[intent], intent, { needs_human: needsHuman, crm_status: crmStatus });
    }

    // 13. Escolha numérica de opção previamente enviada
    if (intent === "escolha_opcao" && state.last_options && state.last_options.length > 0 && state.awaiting === "escolha_periodo") {
      const num = parseInt(effectiveText, 10);
      const escolhida = state.last_options.find((o) => o.n === num);
      if (!escolhida) {
        return replyAndLog(`Não encontrei a opção ${num}. Pode me dizer o número que aparece antes do horário? 😊`, "opcao_invalida");
      }

      const horarios = await buscarHorariosDoPeriodo(supabaseUrl, serviceKey, escolhida.data, escolhida.local, escolhida.periodo);

      // Em produção (não-sandbox), por segurança não criamos agendamento real automaticamente
      if (!sandbox) {
        await supabase.from("agendamentos").update({ status_crm: "PRECISA_DE_HUMANO" }).eq("id", lead.id);
        return replyAndLog(
          `Anotado! ${fmtDataBR(escolhida.data)} no período da ${escolhida.periodo} no ${escolhida.local.includes("Clinicor") ? "Clinicor" : "HGP"}. Vou pedir para nossa equipe finalizar e te confirmar o horário exato 🙏`,
          "agendamento_pendente_humano",
          { needs_human: true, crm_status: "PRECISA_DE_HUMANO" },
        );
      }

      if (horarios.length === 0) {
        return replyAndLog(
          "Esse período acabou de ficar lotado 😕 Vou te passar para nossa equipe escolher outra data com você.",
          "sem_horarios",
          { needs_human: true, crm_status: "PRECISA_DE_HUMANO" },
        );
      }

      // Sandbox: cria automaticamente no primeiro horário livre
      const horarioEscolhido = horarios[0].slice(0, 5);
      const convResp = await fetch(`${supabaseUrl}/functions/v1/converter-lead-agendamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({
          lead_id: lead.id,
          data_agendamento: escolhida.data,
          hora_agendamento: horarioEscolhido,
          local_atendimento: escolhida.local,
          aceita_primeiro_horario: true,
          aceita_contato_whatsapp_email: true,
        }),
      });
      const convJson = await convResp.json().catch(() => ({}));

      if (!convResp.ok || convJson?.error) {
        return replyAndLog(
          "Tive um probleminha para confirmar esse horário 😕 Vou te passar para nossa equipe finalizar o agendamento.",
          "agendamento_falhou",
          { needs_human: true, crm_status: "PRECISA_DE_HUMANO" },
        );
      }

      const novoStatus = crmStatusFromLocal(escolhida.local);
      await supabase
        .from("agendamentos")
        .update({ status_crm: novoStatus, status_funil: "agendado" })
        .eq("id", lead.id);

      saveState(phoneNorm, { last_intent: "agendado", ambiguous_count: 0, awaiting: null, updated_at: Date.now() });

      return replyAndLog(
        [
          `✅ Pronto! Sua consulta está agendada:`,
          ``,
          `📅 ${fmtDataBR(escolhida.data)} às ${horarioEscolhido}`,
          `📍 ${escolhida.local}`,
          ``,
          `O atendimento é por ordem de chegada. Recomendamos chegar com antecedência. Qualquer coisa, é só me chamar 🙏`,
        ].join("\n"),
        "confirmar_agendamento",
        {
          needs_human: false,
          appointment_created: true,
          crm_status: novoStatus,
          appointment: { date: escolhida.data, time: horarioEscolhido, location: escolhida.local },
        },
      );
    }

    // 14. Agendar / saudação → mostrar opções
    if (intent === "agendar_consulta" || intent === "saudacao") {
      const opcoes = await buscarOpcoesAgrupadas(supabaseUrl, serviceKey);
      saveState(phoneNorm, {
        ...state,
        last_intent: "agendar_consulta",
        ambiguous_count: 0,
        awaiting: "escolha_periodo",
        last_options: opcoes,
      });
      const greeting = intent === "saudacao"
        ? "Olá! Sou a assistente do Dr. Juliano Machado, oftalmologista 👋\n\n"
        : "";
      await supabase.from("agendamentos").update({ status_crm: "AGUARDANDO" }).eq("id", lead.id);
      return replyAndLog(greeting + montarTextoOpcoes(opcoes), "agendar_consulta", { crm_status: "AGUARDANDO" });
    }

    // 15. Ambíguo
    const ambig = (state.ambiguous_count ?? 0) + 1;
    saveState(phoneNorm, { ...state, last_intent: "ambiguo", ambiguous_count: ambig });
    if (ambig >= 3) {
      await supabase.from("agendamentos").update({ status_crm: "PRECISA_DE_HUMANO", bot_ativo: false }).eq("id", lead.id);
      return replyAndLog(
        "Acho melhor nossa equipe humana te atender pra entender direitinho 🙏 Já estou chamando alguém aqui.",
        "ambiguo",
        { needs_human: true, crm_status: "PRECISA_DE_HUMANO" },
      );
    }

    return replyAndLog(
      "Não entendi muito bem 😅 Posso te ajudar com:\n• *Agendar* uma consulta\n• Tirar dúvida sobre *endereço*\n• Falar com nossa *equipe humana*\n\nO que você precisa?",
      "ambiguo",
    );
  } catch (err) {
    console.error("[hermes-webhook] erro:", err);
    return jsonResp({
      ok: false,
      action: "none",
      reply_text: null,
      error: err instanceof Error ? err.message : String(err),
    }, 500);
  }
});
