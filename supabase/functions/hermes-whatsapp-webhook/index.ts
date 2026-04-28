// Endpoint seguro para o Hermes Agent enviar eventos de WhatsApp normalizados.
// Autentica via header X-Hermes-Secret. Não envia WhatsApp — apenas devolve `reply_text`.
//
// Comportamento oficial — secretária virtual do Dr. Juliano Machado, oftalmologista (CRM-PA 15253).
// Regras-chave:
//  - Nunca informar RQE.
//  - Nunca dizer que é humano.
//  - Português brasileiro.
//  - Não diagnosticar, não prescrever, não interpretar exames, não indicar cirurgia,
//    não informar preço de cirurgia ou exames.
//  - Não oferecer link /agendamento no fluxo normal — só em erro técnico ou pedido direto.
//  - Consulta particular: R$ 300,00.
//  - Convênios aceitos: Bradesco Saúde, Unimed, Cassi, SulAmérica.
//  - Locais (Paragominas): Clinicor; Hospital Geral de Paragominas (HGP).
//  - Antes de finalizar, sempre confirmar: "Só para confirmar, ficou assim..."
//  - Em produção (não-sandbox): "Seu agendamento foi registrado para confirmação da equipe."
//  - Sandbox: telefone termina em 0174 ou sandbox=true.
//
// Estado da conversa persistido em `public.hermes_conversation_state` (TTL 30min).

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
// Persistência feita via INSERT direto (persistirMensagem) — mais robusto que RPC.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hermes-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LINK_AGENDAMENTO = "https://drjulianomachado.com/agendamento";
const VALOR_PARTICULAR = "R$ 300,00";
const CONVENIOS_ACEITOS = ["Bradesco Saúde", "Unimed", "Cassi", "SulAmérica"];
const CONVENIOS_ACEITOS_TXT = "Bradesco Saúde, Unimed, Cassi e SulAmérica";

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

// ----- Resposta padrão -----
interface EmailData {
  nome_completo: string;
  telefone_whatsapp: string;
  email: string | null;
  data_nascimento: string;
  tipo: string;
  convenio: string;
  valor: string | null;
  data_agendamento: string;
  hora_agendamento: string;
  local_atendimento: string;
}
interface StdResponse {
  ok: boolean;
  lead_id?: string | null;
  action: "reply" | "none" | "booking_confirmed";
  reply_text: string | null;
  crm_status?: string | null;
  intent?: string;
  needs_human?: boolean;
  appointment_created?: boolean;
  appointment?: { date: string; time: string; location: string } | null;
  awaiting?: string | null;
  error?: string;
  sandbox?: boolean;
  deduped?: boolean;
  email_data?: EmailData | null;
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
  "perdi a visão", "perdi a visao", "perda de visao", "perda da visao", "perda visao",
  "não enxergo", "nao enxergo", "fiquei cego", "cegueira súbita", "cegueira subita",
  "trauma ocular", "machuquei o olho", "bati o olho", "produto químico", "produto quimico",
  "queimadura", "sangrando no olho", "muita dor no olho", "dor muito forte no olho",
  "dor insuportável", "dor insuportavel",
  "urgência", "urgencia", "emergência", "emergencia", "socorro",
  "flashes de luz", "moscas volantes súbitas", "moscas volantes subitas", "cortina preta",
];

const INTENT_RULES: Array<{ intent: string; kw: string[] }> = [
  { intent: "pedir_link", kw: ["link", "site", "agendar online", "agendamento online", "url", "página de agendamento", "pagina de agendamento"] },
  { intent: "diagnostico_proibido", kw: ["o que eu tenho", "qual o diagnóstico", "qual o diagnostico", "que doença", "que doenca", "remédio", "remedio", "prescrever", "receita", "qual exame", "interprete", "interpretar exame", "preço da cirurgia", "preco da cirurgia", "valor da cirurgia", "preço do exame", "preco do exame", "valor do exame"] },
  { intent: "cancelar", kw: ["cancelar", "desmarcar", "não posso ir", "nao posso ir", "não vou conseguir", "nao vou"] },
  { intent: "remarcar", kw: ["remarcar", "trocar horário", "trocar horario", "mudar dia", "mudar horario", "outra data"] },
  { intent: "endereco", kw: ["endereço", "endereco", "onde fica", "localização", "localizacao", "como chegar"] },
  { intent: "humano", kw: ["atendente", "humano", "pessoa", "secretária", "secretaria", "falar com alguém", "falar com alguem"] },
  { intent: "agendar_consulta", kw: ["agendar", "marcar", "consulta", "atendimento"] },
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

function normalizeIntentText(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isClearNewSchedulingIntent(text: string, intent: string): boolean {
  if (intent === "urgencia") return false;
  const t = normalizeIntentText(text);
  if (!t || /\b(link|online|site|url)\b/.test(t)) return false;
  return [
    /\b(quero|queria|gostaria|preciso|pode|posso)\s+(agendar|marcar)\b/,
    /\b(agendar|marcar)\s+(uma\s+)?consulta\b/,
    /\bquero\s+(uma\s+)?consulta\b/,
    /\bconsulta\s+com\s+(o\s+)?dr\s+juliano\b/,
  ].some((rule) => rule.test(t));
}

function detectarPaymentType(text: string): "particular" | "convenio" | null {
  const t = text.toLowerCase();
  if (/\bparticular\b|\bprivad/.test(t)) return "particular";
  if (/\bconv[eê]nio\b|\bplano\b|\bplano de sa[uú]de\b/.test(t)) return "convenio";
  // menção direta a um convênio
  if (/\bbradesco\b|\bunimed\b|\bcassi\b|\bsul\s*am[eé]rica\b|\bsulam[eé]rica\b/.test(t)) {
    return "convenio";
  }
  return null;
}

function detectarConvenio(text: string): { aceito: boolean; nome: string | null } {
  const t = text.toLowerCase();
  if (/\bbradesco\b/.test(t)) return { aceito: true, nome: "Bradesco Saúde" };
  if (/\bunimed\b/.test(t)) return { aceito: true, nome: "Unimed" };
  if (/\bcassi\b/.test(t)) return { aceito: true, nome: "Cassi" };
  if (/\bsul\s*am[eé]rica\b|\bsulam[eé]rica\b/.test(t)) return { aceito: true, nome: "SulAmérica" };
  // qualquer outro nome de convênio explicitamente recusado
  if (/\bamil\b|\bhapvida\b|\bnotredame\b|\bgolden\s*cross\b|\bporto\s*seguro\b|\bcabergs\b|\bgeap\b|\bsaude caixa\b|\bsa[uú]de caixa\b/.test(t)) {
    return { aceito: false, nome: t };
  }
  return { aceito: false, nome: null };
}

function detectarLocal(text: string): "Clinicor" | "HGP" | null {
  const t = text.toLowerCase();
  if (/\bclinicor\b/.test(t)) return "Clinicor";
  if (/\bhgp\b|hospital geral/.test(t)) return "HGP";
  return null;
}

function localFull(local: "Clinicor" | "HGP"): string {
  return local === "Clinicor" ? "Clinicor – Paragominas" : "Hospital Geral de Paragominas";
}

function detectarDataNascimento(text: string): string | null {
  // dd/mm/aaaa ou dd-mm-aaaa
  const m = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (!m) return null;
  let [_, d, mo, y] = m;
  if (y.length === 2) y = (parseInt(y, 10) > 30 ? "19" : "20") + y;
  const dd = d.padStart(2, "0");
  const mm = mo.padStart(2, "0");
  const date = new Date(`${y}-${mm}-${dd}T00:00:00`);
  if (isNaN(date.getTime())) return null;
  return `${y}-${mm}-${dd}`;
}

function detectarNomeCompleto(text: string): string | null {
  // Heurística: 2+ palavras alfabéticas (com acentos) e sem dígitos
  const t = text.trim().replace(/\s+/g, " ");
  if (/\d/.test(t)) return null;
  const partes = t.split(" ").filter((p) => /^[A-Za-zÀ-ÿ'’\-]{2,}$/.test(p));
  if (partes.length >= 2) return partes.join(" ");
  return null;
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

function fmtDataNascBR(yyyyMmDd: string): string {
  return fmtDataBR(yyyyMmDd);
}

function crmStatusFromLocal(local: string): string {
  const l = (local || "").toLowerCase();
  if (l.includes("clinicor")) return "CLINICOR";
  if (l.includes("hgp") || l.includes("hospital geral")) return "HGP";
  return "AGENDADO";
}

// ----- Estado persistente -----
interface ConvState {
  phone: string;
  lead_id: string | null;
  last_intent: string | null;
  awaiting:
    | "payment_type"
    | "convenio_nome"
    | "convenio_fallback_particular"
    | "dados_paciente"
    | "escolha_periodo"
    | "confirmacao_final"
    | "collecting_name"
    | "collecting_birthdate"
    | "collecting_payment"
    | "collecting_convenio"
    | "collecting_location"
    | "local_pref"
    | null;
  last_options: Array<{ n: number; data: string; periodo: string; local: string }> | null;
  selected_data: string | null;
  selected_periodo: string | null;
  selected_local: string | null;
  available_slots: string[] | null;
  ambiguous_count: number;
  sandbox: boolean;
  payment_type: "particular" | "convenio" | null;
  convenio: string | null;
  nome_completo: string | null;
  data_nascimento: string | null;
  pending_confirmation: boolean;
  updated_at: string;
}

const STATE_TTL_MIN = 30;

async function loadState(supabase: SupabaseClient, phone: string): Promise<ConvState | null> {
  const { data, error } = await supabase
    .from("hermes_conversation_state")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();
  if (error || !data) return null;
  const ageMin = (Date.now() - new Date(data.updated_at).getTime()) / 60000;
  if (ageMin > STATE_TTL_MIN) return null;
  return data as unknown as ConvState;
}

async function saveState(
  supabase: SupabaseClient,
  phone: string,
  patch: Partial<Omit<ConvState, "phone" | "updated_at">>,
) {
  const row = {
    phone,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("hermes_conversation_state")
    .upsert(row, { onConflict: "phone" });
  if (error) console.error("[hermes-webhook] saveState erro:", error.message);
}

// ----- Lead lookup / creation -----
async function findOrCreateLead(
  supabase: SupabaseClient,
  phone: string,
  sandbox: boolean,
): Promise<{ id: string; created: boolean; status_crm: string | null }> {
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
      sandbox_reason: sandbox
        ? "Hermes webhook (telefone teste 0174 ou sandbox=true)"
        : null,
    })
    .select("id, status_crm")
    .single();

  if (error) throw new Error(`Falha ao criar lead: ${error.message}`);
  return { id: created.id as string, created: true, status_crm: created.status_crm as string };
}

// ----- Auditoria -----
async function logHermes(
  supabase: SupabaseClient,
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

// ----- Sanitização de payload (remove secrets) -----
const SECRET_KEYS_RE = /^(apikey|api_key|token|access_token|authorization|secret|password|x-api-key|hermes-secret|x-hermes-secret)$/i;
function sanitizePayload(input: unknown, depth = 0): unknown {
  if (depth > 8 || input == null) return input;
  if (Array.isArray(input)) return input.map((v) => sanitizePayload(v, depth + 1));
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (SECRET_KEYS_RE.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = sanitizePayload(v, depth + 1);
      }
    }
    return out;
  }
  return input;
}

// ----- Transcrição de áudio (Lovable AI Gateway / Gemini) -----
function findInObject(obj: unknown, keys: string[], depth = 0): unknown {
  if (depth > 8 || obj == null || typeof obj !== "object") return undefined;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (keys.includes(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) {
      return v;
    }
    if (v && typeof v === "object") {
      const found = findInObject(v, keys, depth + 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

async function downloadAudioAsBase64(url: string): Promise<{ base64: string; mime: string } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") || "audio/ogg";
    const buf = new Uint8Array(await resp.arrayBuffer());
    // base64 encode
    let bin = "";
    for (let i = 0; i < buf.byteLength; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    return { base64: b64, mime: ct.split(";")[0].trim() };
  } catch (e) {
    console.error("[hermes-webhook] downloadAudio falhou:", (e as Error).message);
    return null;
  }
}

interface TranscriptionResult {
  ok: boolean;
  text: string | null;
  provider: string;
  error?: string;
}

async function transcribeAudio(rawPayload: unknown): Promise<TranscriptionResult> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) {
    return { ok: false, text: null, provider: "lovable-ai-gemini", error: "LOVABLE_API_KEY not configured" };
  }

  // 1. Tenta encontrar base64 no payload
  let base64 = findInObject(rawPayload, ["base64", "audioBase64", "mediaBase64"]) as string | undefined;
  let mime = (findInObject(rawPayload, ["mimetype", "mime_type", "mimeType"]) as string | undefined) || "audio/ogg";

  // 2. Caso contrário, tenta URL direta
  if (!base64) {
    const url = findInObject(rawPayload, ["url", "directPath", "mediaUrl"]) as string | undefined;
    if (url && /^https?:\/\//i.test(url)) {
      const dl = await downloadAudioAsBase64(url);
      if (dl) {
        base64 = dl.base64;
        mime = dl.mime || mime;
      }
    }
  }

  if (!base64) {
    return { ok: false, text: null, provider: "lovable-ai-gemini", error: "no audio source (base64/url) in payload" };
  }

  // Normaliza mime aceito por Gemini
  if (!/^audio\//.test(mime)) mime = "audio/ogg";

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um transcritor de áudio em português brasileiro. Transcreva LITERALMENTE o que o usuário disse no áudio, sem comentários, sem aspas, sem prefixos. Se não houver fala compreensível, responda exatamente: [áudio inaudível].",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcreva este áudio em português:" },
              { type: "input_audio", input_audio: { data: base64, format: mime.replace(/^audio\//, "") } },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      const errTxt = await resp.text().catch(() => "");
      return {
        ok: false,
        text: null,
        provider: "lovable-ai-gemini",
        error: `gateway ${resp.status}: ${errTxt.slice(0, 300)}`,
      };
    }
    const json = await resp.json().catch(() => ({}));
    const text = json?.choices?.[0]?.message?.content?.toString().trim() || "";
    if (!text || /^\[áudio inaud[íi]vel\]$/i.test(text)) {
      return { ok: false, text: null, provider: "lovable-ai-gemini", error: "transcription empty/inaudible" };
    }
    return { ok: true, text, provider: "lovable-ai-gemini" };
  } catch (e) {
    return {
      ok: false,
      text: null,
      provider: "lovable-ai-gemini",
      error: (e as Error).message,
    };
  }
}

// ----- Persistência direta (bypass RPC para garantir gravação) -----
async function persistirMensagem(
  supabase: SupabaseClient,
  args: {
    telefone: string;
    agendamentoId: string | null;
    direcao: "IN" | "OUT";
    conteudo: string;
    tipoMensagem: string;
    statusEnvio: string;
    mensagemExternaId?: string | null;
    payload?: Record<string, unknown> | null;
  },
): Promise<{ ok: boolean; id: string | null; error: string | null }> {
  try {
    const tiposValidos = new Set([
      "manual", "confirmacao", "confirmacao_automatica", "lembrete_24h", "boas_vindas",
      "bot_pre_agendamento", "avaliacao", "lembrete_anual", "sistema",
      "recebida", "imagem", "audio", "video", "documento", "sticker", "reacao",
      "resposta_automatica",
    ]);
    const tipo = tiposValidos.has(args.tipoMensagem) ? args.tipoMensagem : "sistema";

    const { data, error } = await supabase
      .from("mensagens_whatsapp")
      .insert({
        agendamento_id: args.agendamentoId,
        telefone: args.telefone,
        direcao: args.direcao,
        conteudo: args.conteudo,
        tipo_mensagem: tipo,
        status_envio: args.statusEnvio,
        mensagem_externa_id: args.mensagemExternaId ?? null,
        payload: args.payload ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[hermes-webhook] persistirMensagem ERRO:", error.message, error.details);
      try {
        await supabase.from("system_logs").insert({
          level: "error",
          category: "whatsapp",
          source: "hermes-webhook",
          message: `persist_${args.direcao}_falhou`,
          details: { error: error.message, code: error.code, details: error.details, telefone: args.telefone, mensagem_externa_id: args.mensagemExternaId ?? null },
        });
      } catch (_) { /* ignore */ }
      return { ok: false, id: null, error: error.message };
    }
    return { ok: true, id: (data?.id as string) ?? null, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[hermes-webhook] persistirMensagem exceção:", msg);
    return { ok: false, id: null, error: msg };
  }
}

// ----- Salvar OUT -----
async function salvarOutbound(
  supabase: SupabaseClient,
  phoneNorm: string,
  agendamentoId: string,
  texto: string,
  intent: string,
) {
  await persistirMensagem(supabase, {
    telefone: phoneNorm,
    agendamentoId,
    direcao: "OUT",
    conteudo: texto,
    tipoMensagem: "sistema",
    statusEnvio: "enviado",
    payload: { source: "hermes-webhook", intent, status_envio_real: "preparado_hermes" },
  });
}

// ----- Disponibilidade agrupada -----
async function buscarOpcoesAgrupadas(
  supabaseUrl: string,
  serviceKey: string,
  localPreferido: "Clinicor" | "HGP" | null,
): Promise<Array<{ n: number; data: string; periodo: string; local: string }>> {
  const hoje = new Date();
  const meses = [
    { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() },
    {
      mes: hoje.getMonth() + 2 > 12 ? 1 : hoje.getMonth() + 2,
      ano: hoje.getMonth() + 2 > 12 ? hoje.getFullYear() + 1 : hoje.getFullYear(),
    },
  ];
  const todos = ["Clinicor – Paragominas", "Hospital Geral de Paragominas"];
  const locais = localPreferido
    ? [localFull(localPreferido)]
    : todos;
  const opcoes: Array<{ data: string; periodo: string; local: string }> = [];

  for (const local of locais) {
    for (const m of meses) {
      const resp = await fetch(`${supabaseUrl}/functions/v1/listar-datas-disponiveis`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ mes: m.mes, ano: m.ano, local_atendimento: local }),
      });
      if (!resp.ok) {
        await resp.text().catch(() => "");
        continue;
      }
      const json = await resp.json().catch(() => ({}));
      const datas: Array<{ data: string }> = json?.datas_disponiveis ?? [];
      for (const d of datas.slice(0, 4)) {
        const r2 = await fetch(`${supabaseUrl}/functions/v1/listar-horarios-disponiveis`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ data: d.data, local_atendimento: local }),
        });
        if (!r2.ok) {
          await r2.text().catch(() => "");
          continue;
        }
        const j2 = await r2.json().catch(() => ({}));
        const horarios: string[] = (j2?.horarios_disponiveis ?? [])
          .map((h: any) => (typeof h === "string" ? h : h?.hora ?? ""))
          .filter(Boolean);
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
  if (!resp.ok) {
    await resp.text().catch(() => "");
    return [];
  }
  const j = await resp.json().catch(() => ({}));
  const horarios: string[] = (j?.horarios_disponiveis ?? [])
    .map((h: any) => (typeof h === "string" ? h : h?.hora ?? ""))
    .filter(Boolean);
  return horarios.filter((h) => periodoFromHora(h) === periodo);
}

function montarTextoOpcoes(
  opcoes: Array<{ n: number; data: string; periodo: string; local: string }>,
): string {
  if (opcoes.length === 0) {
    return "No momento não tenho horários disponíveis para confirmar com você. Vou registrar e nossa equipe entra em contato com novas datas, ok? 🙏";
  }
  const linhas = opcoes.map(
    (o) =>
      `${o.n}) ${fmtDataBR(o.data).slice(0, 5)} — ${o.periodo} — ${
        o.local.includes("Clinicor") ? "Clinicor" : "HGP"
      }`,
  );
  return [
    "Tenho estas opções de data para sua consulta com o Dr. Juliano:",
    "",
    ...linhas,
    "",
    "Responda com o *número* da opção que prefere. 😊",
  ].join("\n");
}

// Próxima pergunta na ordem obrigatória: nome → nascimento → pagamento → local
type ProximaPergunta =
  | { stage: "collecting_name"; text: string }
  | { stage: "collecting_birthdate"; text: string }
  | { stage: "collecting_payment"; text: string }
  | { stage: "collecting_convenio"; text: string }
  | { stage: "collecting_location"; text: string }
  | null;

function proximaPergunta(
  nome: string | null,
  nasc: string | null,
  paymentType: "particular" | "convenio" | null,
  convenio: string | null,
  local: "Clinicor" | "HGP" | null,
): ProximaPergunta {
  if (!nome) {
    return {
      stage: "collecting_name",
      text: "Claro, vou te ajudar com o agendamento 😊\n\nQual é o *nome completo* do paciente?",
    };
  }
  if (!nasc) {
    return {
      stage: "collecting_birthdate",
      text: "Obrigado! Qual é a *data de nascimento* do paciente? (dd/mm/aaaa)",
    };
  }
  if (!paymentType) {
    return {
      stage: "collecting_payment",
      text: [
        "O atendimento será *particular* ou por *convênio*?",
        "",
        "1) Particular — R$ 300,00",
        "2) Bradesco Saúde",
        "3) Unimed",
        "4) Cassi",
        "5) SulAmérica",
        "",
        "Responda com o *número* da opção.",
      ].join("\n"),
    };
  }
  if (paymentType === "convenio" && !convenio) {
    return {
      stage: "collecting_convenio",
      text: [
        "Qual o seu convênio?",
        "",
        "2) Bradesco Saúde",
        "3) Unimed",
        "4) Cassi",
        "5) SulAmérica",
        "",
        "Responda com o *número* da opção.",
      ].join("\n"),
    };
  }
  if (!local) {
    return {
      stage: "collecting_location",
      text: [
        "Qual *local* você prefere para o atendimento?",
        "",
        "1) Clinicor — Paragominas",
        "2) HGP / Hospital Geral de Paragominas",
        "",
        "Responda com o *número* da opção.",
      ].join("\n"),
    };
  }
  return null;
}

// Mapeia opção numérica de pagamento (1-5)
function opcaoPagamento(text: string): { payment_type: "particular" | "convenio"; convenio: string | null } | null {
  const t = text.trim();
  if (/^1\b/.test(t)) return { payment_type: "particular", convenio: null };
  if (/^2\b/.test(t)) return { payment_type: "convenio", convenio: "Bradesco Saúde" };
  if (/^3\b/.test(t)) return { payment_type: "convenio", convenio: "Unimed" };
  if (/^4\b/.test(t)) return { payment_type: "convenio", convenio: "Cassi" };
  if (/^5\b/.test(t)) return { payment_type: "convenio", convenio: "SulAmérica" };
  return null;
}

// Mapeia opção numérica de local (1-2)
function opcaoLocal(text: string): "Clinicor" | "HGP" | null {
  const t = text.trim();
  if (/^1\b/.test(t)) return "Clinicor";
  if (/^2\b/.test(t)) return "HGP";
  return null;
}

function textoConfirmacaoFinal(s: {
  nome_completo: string;
  data_nascimento: string;
  payment_type: "particular" | "convenio";
  convenio: string | null;
  selected_local: string;
  selected_data: string;
  selected_periodo: string;
}): string {
  const pagamento =
    s.payment_type === "particular"
      ? `Particular (${VALOR_PARTICULAR})`
      : `Convênio ${s.convenio}`;
  const local = s.selected_local.includes("Clinicor")
    ? "Clinicor – Paragominas"
    : "Hospital Geral de Paragominas (HGP)";
  return [
    "Só para confirmar, ficou assim:",
    "",
    `👤 ${s.nome_completo}`,
    `🎂 ${fmtDataNascBR(s.data_nascimento)}`,
    `💳 ${pagamento}`,
    `📍 ${local}`,
    `📅 ${fmtDataBR(s.selected_data)} — período da ${s.selected_periodo}`,
    "",
    "Posso confirmar? Responda *sim* para finalizar ou me diga o que ajustar.",
  ].join("\n");
}

// ----- Handler -----
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResp(
      { ok: false, action: "none", reply_text: null, error: "Method not allowed" },
      405,
    );
  }

  // 1. Auth
  const expectedSecret = Deno.env.get("HERMES_WEBHOOK_SECRET");
  const headerSecret = req.headers.get("x-hermes-secret");
  if (!expectedSecret) {
    return jsonResp(
      { ok: false, action: "none", reply_text: null, error: "Server misconfigured" },
      500,
    );
  }
  if (!headerSecret || headerSecret !== expectedSecret) {
    return jsonResp(
      { ok: false, action: "none", reply_text: null, error: "Unauthorized" },
      401,
    );
  }

  // 2. Parse + validate
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResp(
      { ok: false, action: "none", reply_text: null, error: "Invalid JSON" },
      400,
    );
  }
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResp(
      { ok: false, action: "none", reply_text: null, error: "Invalid payload" },
      400,
    );
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
      return jsonResp({
        ok: true,
        action: "none",
        reply_text: null,
        deduped: true,
        sandbox,
      });
    }
  }

  try {
    // 5. Lead
    const lead = await findOrCreateLead(supabase, phoneNorm, sandbox);

    // 6. Texto efetivo
    const isMedia = ["audio", "image", "video", "document", "sticker", "media"].includes(
      p.message_type,
    );
    let effectiveText = (p.text || "").trim();

    // 7. Salvar IN — SEMPRE persistir, antes de qualquer processamento de IA/bot.
    const mapTipoIN = (mt: string): string => {
      switch (mt) {
        case "text": return "recebida";
        case "audio": return "audio";
        case "image": return "imagem";
        case "video": return "video";
        case "document": return "documento";
        case "sticker": return "sticker";
        case "reaction": return "reacao";
        case "media": return "imagem";
        default: return "recebida";
      }
    };
    const tipoMsg = mapTipoIN(p.message_type);
    const conteudoIN = effectiveText
      || (p.message_type === "audio" ? "[áudio recebido sem transcrição]"
        : p.message_type === "image" ? "[imagem recebida]"
        : p.message_type === "video" ? "[vídeo recebido]"
        : p.message_type === "document" ? "[documento recebido]"
        : p.message_type === "sticker" ? "[sticker recebido]"
        : `[${p.message_type}]`);

    // Sanitiza payload antes de persistir (remove apikey/token/etc.)
    const sanitizedRaw = (sanitizePayload(p.raw_payload) as Record<string, unknown> | null) ?? {
      event: p.event,
      instance: p.instance,
      source: "hermes",
      message_type: p.message_type,
    };

    const persistResult = await persistirMensagem(supabase, {
      telefone: phoneNorm,
      agendamentoId: lead.id,
      direcao: "IN",
      conteudo: conteudoIN,
      tipoMensagem: tipoMsg,
      statusEnvio: "entregue",
      mensagemExternaId: p.external_message_id ?? null,
      payload: sanitizedRaw,
    });
    if (!persistResult.ok) {
      console.error("[hermes-webhook] FALHA ao persistir IN:", persistResult.error);
    } else {
      console.log("[hermes-webhook] IN persistida:", persistResult.id, "tipo:", tipoMsg);
    }

    // 7.b TRANSCRIÇÃO DE ÁUDIO — usa raw_payload original (não sanitizado) para acessar mídia
    if (p.message_type === "audio" && !effectiveText) {
      const t0 = Date.now();
      const tr = await transcribeAudio(p.raw_payload);
      const elapsed = Date.now() - t0;

      if (tr.ok && tr.text) {
        const novoConteudo = `[Áudio transcrito] ${tr.text}`;
        const novoPayload = {
          ...sanitizedRaw,
          transcription_status: "success",
          transcription_text: tr.text,
          transcription_provider: tr.provider,
          transcription_at: new Date().toISOString(),
          transcription_latency_ms: elapsed,
        };
        // Atualiza pela mensagem externa, ou pelo ID retornado
        if (p.external_message_id) {
          await supabase
            .from("mensagens_whatsapp")
            .update({ conteudo: novoConteudo, payload: novoPayload })
            .eq("mensagem_externa_id", p.external_message_id);
        } else if (persistResult.id) {
          await supabase
            .from("mensagens_whatsapp")
            .update({ conteudo: novoConteudo, payload: novoPayload })
            .eq("id", persistResult.id);
        }
        // Substitui texto efetivo pela transcrição → entra no fluxo normal
        effectiveText = tr.text;
        console.log("[hermes-webhook] áudio transcrito em", elapsed, "ms:", tr.text.slice(0, 80));
      } else {
        await supabase.from("system_logs").insert({
          level: "error",
          category: "whatsapp",
          source: "hermes-webhook",
          message: "audio_transcription_failed",
          details: {
            error: tr.error,
            provider: tr.provider,
            telefone: phoneNorm,
            mensagem_externa_id: p.external_message_id ?? null,
            latency_ms: elapsed,
          },
          agendamento_id: lead.id,
        });
        // marca falha no payload da mensagem
        const failPayload = {
          ...sanitizedRaw,
          transcription_status: "failed",
          transcription_provider: tr.provider,
          transcription_error: tr.error,
          transcription_at: new Date().toISOString(),
        };
        if (p.external_message_id) {
          await supabase
            .from("mensagens_whatsapp")
            .update({ payload: failPayload })
            .eq("mensagem_externa_id", p.external_message_id);
        } else if (persistResult.id) {
          await supabase
            .from("mensagens_whatsapp")
            .update({ payload: failPayload })
            .eq("id", persistResult.id);
        }
      }
    }

    // Helper
    const replyAndLog = async (
      reply: string,
      intent: string,
      extras: Partial<StdResponse> = {},
    ) => {
      await salvarOutbound(supabase, phoneNorm, lead.id, reply, intent);
      await logHermes(supabase, lead.id, "reply", intent, {
        sandbox,
        external_message_id: p.external_message_id ?? null,
        needs_human: extras.needs_human ?? false,
        appointment_created: extras.appointment_created ?? false,
        crm_status: extras.crm_status ?? null,
        awaiting: extras.awaiting ?? null,
      });
      return jsonResp({
        ok: true,
        lead_id: lead.id,
        action: extras.action ?? "reply",
        reply_text: reply,
        crm_status: extras.crm_status ?? lead.status_crm ?? "NOVO LEAD",
        intent,
        needs_human: extras.needs_human ?? false,
        appointment_created: extras.appointment_created ?? false,
        appointment: extras.appointment ?? null,
        awaiting: extras.awaiting ?? null,
        sandbox,
        email_data: extras.email_data ?? null,
      });
    };

    // 8. Mídia sem transcrição (NÃO áudio: imagem, vídeo, doc, sticker)
    //    Para áudio só cai aqui se a transcrição falhou e effectiveText continua vazio.
    if (isMedia && !effectiveText) {
      return replyAndLog(
        "Recebi seu áudio/imagem 🙏 Pode me escrever em texto o que você precisa? Assim consigo te ajudar mais rápido.",
        "midia_sem_transcricao",
      );
    }

    // 9. Classificar
    const intent = classifyIntent(effectiveText);
    const state = (await loadState(supabase, phoneNorm)) ?? null;
    const txtLower = effectiveText.toLowerCase();

    // 10. URGÊNCIA — prioridade máxima
    if (intent === "urgencia") {
      await supabase
        .from("agendamentos")
        .update({ status_crm: "URGENTE", bot_ativo: false })
        .eq("id", lead.id);
      await saveState(supabase, phoneNorm, {
        lead_id: lead.id,
        last_intent: intent,
        ambiguous_count: 0,
        awaiting: null,
        sandbox,
      });
      return replyAndLog(
        "Esse sintoma pode precisar de avaliação urgente. Recomendo procurar atendimento médico ou serviço de urgência oftalmológica o quanto antes. 🙏",
        "urgencia",
        { needs_human: true, crm_status: "URGENTE" },
      );
    }

    // 11. Pedido direto de link
    if (intent === "pedir_link") {
      return replyAndLog(
        `Claro! Você também pode agendar pelo nosso site:\n${LINK_AGENDAMENTO}\n\nSe preferir, posso te ajudar por aqui mesmo. 😊`,
        "pedir_link",
      );
    }

    // 12. Diagnóstico/prescrição/preço de exame ou cirurgia (proibido)
    if (intent === "diagnostico_proibido") {
      return replyAndLog(
        "Por aqui não consigo avaliar sintomas, indicar exames, interpretar resultados, sugerir cirurgia ou informar valores de exames e cirurgias 🙏 Tudo isso o Dr. Juliano avalia pessoalmente na consulta. Posso te ajudar a agendar?",
        "diagnostico_proibido",
      );
    }

    // 13. Pedido de humano
    if (intent === "humano") {
      await supabase
        .from("agendamentos")
        .update({ status_crm: "PRECISA_DE_HUMANO", bot_ativo: false })
        .eq("id", lead.id);
      return replyAndLog(
        "Claro! Vou registrar para nossa equipe te atender por aqui em instantes 🙏",
        "humano",
        { needs_human: true, crm_status: "PRECISA_DE_HUMANO" },
      );
    }

    // 14. cancelar / remarcar / endereço
    if (["cancelar", "remarcar", "endereco"].includes(intent)) {
      const replies: Record<string, string> = {
        cancelar:
          "Sem problema! Vou registrar seu pedido de cancelamento para nossa equipe finalizar com você 🙏",
        remarcar:
          "Posso te ajudar a remarcar! Nossa equipe vai te confirmar as novas opções de horário em instantes 🙏",
        endereco:
          "Atendemos em Paragominas:\n• *Clinicor* — Paragominas\n• *HGP* — Hospital Geral de Paragominas\n\nQuer que eu te ajude a agendar?",
      };
      const needsHuman = intent !== "endereco";
      let crmStatus = lead.status_crm ?? "NOVO LEAD";
      if (needsHuman) {
        crmStatus = "PRECISA_DE_HUMANO";
        await supabase
          .from("agendamentos")
          .update({ status_crm: crmStatus, bot_ativo: false })
          .eq("id", lead.id);
      }
      return replyAndLog(replies[intent], intent, {
        needs_human: needsHuman,
        crm_status: crmStatus,
      });
    }

    // ============================================================
    // FLUXO DE AGENDAMENTO (multi-etapas)
    // ============================================================

    // Estado de coleta corrente (parte do state ou vazio)
    let payment_type = state?.payment_type ?? null;
    let convenio = state?.convenio ?? null;
    let nome_completo = state?.nome_completo ?? null;
    let data_nascimento = state?.data_nascimento ?? null;
    let local_pref: "Clinicor" | "HGP" | null = state?.selected_local
      ? state.selected_local.includes("Clinicor")
        ? "Clinicor"
        : "HGP"
      : null;

    // Tentar extrair dados do texto atual (sempre)
    const ptDetect = detectarPaymentType(effectiveText);
    if (ptDetect) payment_type = ptDetect;

    const conv = detectarConvenio(effectiveText);
    if (conv.aceito) {
      convenio = conv.nome;
      payment_type = "convenio";
    }

    const localDetect = detectarLocal(effectiveText);
    if (localDetect) local_pref = localDetect;

    const nascDetect = detectarDataNascimento(effectiveText);
    if (nascDetect) data_nascimento = nascDetect;

    // Opções numeradas — somente quando estamos no estágio correspondente,
    // para não conflitar com escolha de slot (escolha_periodo).
    if (state?.awaiting === "payment_type" || state?.awaiting === "convenio_nome") {
      const op = opcaoPagamento(effectiveText);
      if (op) {
        payment_type = op.payment_type;
        if (op.convenio) convenio = op.convenio;
      }
    }
    if (state?.awaiting === "local_pref") {
      const ol = opcaoLocal(effectiveText);
      if (ol) local_pref = ol;
    }

    // Nome completo: só capturar se estamos coletando nome OU se ainda não temos nome
    // e o texto NÃO é uma intenção/pedido conhecido (ex.: "quero agendar uma consulta").
    const nomeDetect = detectarNomeCompleto(effectiveText);
    const isPedidoAgendar = intent === "agendar_consulta" || intent === "saudacao";
    if (nomeDetect && !nome_completo && (state?.awaiting === "collecting_name" || !isPedidoAgendar)) {
      // Evita capturar "Quero Agendar Uma Consulta" como nome
      if (!/agendar|consulta|marcar|atendimento|particular|conv[eê]nio/i.test(nomeDetect)) {
        nome_completo = nomeDetect;
      }
    }

    const wantsAgendar =
      intent === "agendar_consulta" ||
      intent === "saudacao" ||
      state?.awaiting === "collecting_name" ||
      state?.awaiting === "collecting_birthdate" ||
      state?.awaiting === "collecting_payment" ||
      state?.awaiting === "collecting_convenio" ||
      state?.awaiting === "collecting_location" ||
      state?.awaiting === "payment_type" ||
      state?.awaiting === "convenio_nome" ||
      state?.awaiting === "convenio_fallback_particular" ||
      state?.awaiting === "dados_paciente" ||
      state?.awaiting === "escolha_periodo" ||
      state?.awaiting === "confirmacao_final";

    // 15. Confirmação final pendente
    if (state?.awaiting === "confirmacao_final" && state?.pending_confirmation) {
      const sim = /^(sim|ok|confirmo|confirmar|pode|isso|isso mesmo|claro|certo|👍|✅)\b/i.test(
        effectiveText,
      );
      const nao = /^(n[ãa]o|nao|cancelar|errado|trocar|mudar)\b/i.test(effectiveText);

      if (nao) {
        await saveState(supabase, phoneNorm, {
          lead_id: lead.id,
          last_intent: "confirmacao_negada",
          ambiguous_count: 0,
          awaiting: "dados_paciente",
          pending_confirmation: false,
          sandbox,
        });
        return replyAndLog(
          "Sem problema! Me diga o que você quer ajustar (nome, data de nascimento, local, data ou convênio) 🙏",
          "confirmacao_negada",
        );
      }

      if (!sim) {
        return replyAndLog(
          "Posso confirmar então? Responda *sim* para finalizar ou me diga o que ajustar.",
          "confirmacao_aguardando",
          { awaiting: "confirmacao_final" },
        );
      }

      // Confirmou. Em produção: trava humana. Em sandbox: cria agendamento.
      const escolhida_data = state.selected_data!;
      const escolhida_local = state.selected_local!;
      const escolhida_periodo = state.selected_periodo!;

      // Atualizar dados do lead com nome/nascimento/convenio/local
      await supabase
        .from("agendamentos")
        .update({
          nome_completo: state.nome_completo,
          data_nascimento: state.data_nascimento,
          local_atendimento: escolhida_local,
          convenio:
            state.payment_type === "particular"
              ? "Particular"
              : (state.convenio ?? "Particular"),
        })
        .eq("id", lead.id);

      if (!sandbox) {
        await supabase
          .from("agendamentos")
          .update({ status_crm: "PRECISA_DE_HUMANO" })
          .eq("id", lead.id);
        await saveState(supabase, phoneNorm, {
          lead_id: lead.id,
          last_intent: "agendamento_pendente_humano",
          ambiguous_count: 0,
          awaiting: null,
          pending_confirmation: false,
          sandbox,
        });
        return replyAndLog(
          "Seu agendamento foi registrado para confirmação da equipe. Em instantes te confirmamos o horário exato por aqui 🙏",
          "agendamento_pendente_humano",
          { needs_human: true, crm_status: "PRECISA_DE_HUMANO" },
        );
      }

      // Sandbox: confere agenda real e cria agendamento
      const horarios = await buscarHorariosDoPeriodo(
        supabaseUrl,
        serviceKey,
        escolhida_data,
        escolhida_local,
        escolhida_periodo,
      );
      if (horarios.length === 0) {
        await saveState(supabase, phoneNorm, {
          lead_id: lead.id,
          last_intent: "sem_horarios",
          ambiguous_count: 0,
          awaiting: null,
          pending_confirmation: false,
          sandbox,
        });
        return replyAndLog(
          "Esse período acabou de ficar sem vagas 😕 Vou registrar para nossa equipe te oferecer outras datas.",
          "sem_horarios",
          { needs_human: true, crm_status: "PRECISA_DE_HUMANO" },
        );
      }
      const horarioEscolhido = horarios[0].slice(0, 5);

      const convResp = await fetch(
        `${supabaseUrl}/functions/v1/converter-lead-agendamento`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            lead_id: lead.id,
            data_agendamento: escolhida_data,
            hora_agendamento: horarioEscolhido,
            local_atendimento: escolhida_local,
            aceita_primeiro_horario: true,
            aceita_contato_whatsapp_email: true,
          }),
        },
      );
      const convText = await convResp.text();
      let convJson: any = {};
      try { convJson = JSON.parse(convText); } catch { /* */ }

      if (!convResp.ok || convJson?.error) {
        console.error("[hermes-webhook] converter-lead falhou:", convResp.status, convText);
        return replyAndLog(
          `Tive um probleminha técnico para confirmar esse horário 😕 Você pode tentar pelo nosso site: ${LINK_AGENDAMENTO}\n\nNossa equipe também já foi avisada e vai te ajudar.`,
          "agendamento_falhou",
          { needs_human: true, crm_status: "PRECISA_DE_HUMANO" },
        );
      }

      const novoStatus = crmStatusFromLocal(escolhida_local);
      await supabase
        .from("agendamentos")
        .update({ status_crm: novoStatus, status_funil: "agendado" })
        .eq("id", lead.id);

      await saveState(supabase, phoneNorm, {
        lead_id: lead.id,
        last_intent: "agendado",
        ambiguous_count: 0,
        awaiting: null,
        last_options: null,
        available_slots: null,
        pending_confirmation: false,
        sandbox,
      });

      // Buscar e-mail do lead (se já existir)
      const { data: leadFull } = await supabase
        .from("agendamentos")
        .select("email")
        .eq("id", lead.id)
        .maybeSingle();

      const localFullStr = escolhida_local.includes("Clinicor")
        ? "Clinicor – Paragominas"
        : "Hospital Geral de Paragominas";

      const emailData: EmailData = {
        nome_completo: state.nome_completo!,
        telefone_whatsapp: phoneNorm,
        email: (leadFull?.email as string | null) ?? null,
        data_nascimento: state.data_nascimento!,
        tipo: "Consulta oftalmológica",
        convenio: state.payment_type === "particular" ? "Particular" : (state.convenio ?? "Particular"),
        valor: state.payment_type === "particular" ? VALOR_PARTICULAR : null,
        data_agendamento: escolhida_data,
        hora_agendamento: horarioEscolhido,
        local_atendimento: localFullStr,
      };

      return replyAndLog(
        [
          `Agendamento confirmado ✅`,
          ``,
          `Dr. Juliano Machado`,
          `CRM-PA 15253`,
          ``,
          `📍 ${localFullStr}`,
          `📅 ${fmtDataBR(escolhida_data)}`,
          `🕒 ${horarioEscolhido}`,
          ``,
          `Se precisar alterar, é só avisar por aqui. 🙏`,
        ].join("\n"),
        "confirmar_agendamento",
        {
          action: "booking_confirmed",
          needs_human: false,
          appointment_created: true,
          crm_status: novoStatus,
          appointment: {
            date: escolhida_data,
            time: horarioEscolhido,
            location: escolhida_local,
          },
          email_data: emailData,
        },
      );
    }

    // 16. Escolha de opção (número) — depois de já ter dados mínimos
    if (
      intent === "escolha_opcao" &&
      state?.awaiting === "escolha_periodo" &&
      state?.last_options &&
      state.last_options.length > 0
    ) {
      const num = parseInt(effectiveText, 10);
      const escolhida = state.last_options.find((o) => o.n === num);
      if (!escolhida) {
        return replyAndLog(
          `Não encontrei a opção ${num}. Pode me dizer o número que aparece antes da data? 😊`,
          "opcao_invalida",
          { awaiting: "escolha_periodo" },
        );
      }

      // Salva escolha e pula para confirmação final
      await saveState(supabase, phoneNorm, {
        lead_id: lead.id,
        last_intent: "escolha_opcao",
        ambiguous_count: 0,
        awaiting: "confirmacao_final",
        selected_data: escolhida.data,
        selected_periodo: escolhida.periodo,
        selected_local: escolhida.local,
        pending_confirmation: true,
        payment_type: state.payment_type,
        convenio: state.convenio,
        nome_completo: state.nome_completo,
        data_nascimento: state.data_nascimento,
        sandbox,
      });

      return replyAndLog(
        textoConfirmacaoFinal({
          nome_completo: state.nome_completo!,
          data_nascimento: state.data_nascimento!,
          payment_type: state.payment_type!,
          convenio: state.convenio,
          selected_local: escolhida.local,
          selected_data: escolhida.data,
          selected_periodo: escolhida.periodo,
        }),
        "confirmacao_final",
        { awaiting: "confirmacao_final" },
      );
    }

    // 17. Início ou continuação do fluxo de agendamento — ORDEM ESTRITA
    //     nome → data_nascimento → particular/convênio → local → datas
    if (wantsAgendar) {
      // Atualizar status para AGUARDANDO no primeiro contato
      if (intent === "agendar_consulta" || intent === "saudacao") {
        await supabase
          .from("agendamentos")
          .update({ status_crm: "AGUARDANDO" })
          .eq("id", lead.id);
      }

      // 17.0 Fallback antigo: usuário responde sim/não para "seguir particular"
      if (state?.awaiting === "convenio_fallback_particular") {
        if (/^(sim|ok|pode|claro|quero|1\b)/i.test(effectiveText)) {
          payment_type = "particular";
          convenio = null;
        } else if (/^(n[ãa]o|nao)\b/i.test(effectiveText)) {
          await saveState(supabase, phoneNorm, {
            lead_id: lead.id,
            last_intent: "encerrar_convenio_recusa",
            ambiguous_count: 0,
            awaiting: null,
            sandbox,
          });
          return replyAndLog(
            `Sem problema 🙏 Quando precisar, é só me chamar. Os convênios aceitos são: ${CONVENIOS_ACEITOS_TXT}.`,
            "encerrar_convenio_recusa",
          );
        } else {
          return replyAndLog(
            `Deseja seguir como *particular* (${VALOR_PARTICULAR})? Responda *sim* ou *não*.`,
            "aguardando_fallback_particular",
            { awaiting: "convenio_fallback_particular" },
          );
        }
      }

      // 17.1 Convênio mencionado mas não aceito
      if (payment_type === "convenio" && !convenio) {
        const conv2 = detectarConvenio(effectiveText);
        if (conv2.nome && !conv2.aceito) {
          await saveState(supabase, phoneNorm, {
            lead_id: lead.id,
            last_intent: "convenio_nao_aceito",
            ambiguous_count: 0,
            awaiting: "convenio_fallback_particular",
            payment_type: "convenio",
            convenio: null,
            nome_completo,
            data_nascimento,
            sandbox,
          });
          return replyAndLog(
            `No momento atendemos por convênio: *${CONVENIOS_ACEITOS_TXT}*. Deseja seguir como *particular* (${VALOR_PARTICULAR})?`,
            "convenio_nao_aceito",
            { awaiting: "convenio_fallback_particular" },
          );
        }
      }

      // 17.2 Próxima pergunta na ordem estrita
      const prox = proximaPergunta(nome_completo, data_nascimento, payment_type, convenio, local_pref);
      if (prox) {
        const stageToAwaiting: Record<string, ConvState["awaiting"]> = {
          collecting_name: "collecting_name",
          collecting_birthdate: "collecting_birthdate",
          collecting_payment: "payment_type",
          collecting_convenio: "convenio_nome",
          collecting_location: "local_pref",
        };
        await saveState(supabase, phoneNorm, {
          lead_id: lead.id,
          last_intent: prox.stage,
          ambiguous_count: 0,
          awaiting: stageToAwaiting[prox.stage] ?? "dados_paciente",
          payment_type,
          convenio,
          nome_completo,
          data_nascimento,
          selected_local: local_pref ? localFull(local_pref) : null,
          sandbox,
        });
        return replyAndLog(prox.text, prox.stage, {
          crm_status: "AGUARDANDO",
          awaiting: stageToAwaiting[prox.stage] ?? "dados_paciente",
        });
      }

      // 17.3 Tudo coletado — buscar opções de data reais
      const opcoes = await buscarOpcoesAgrupadas(supabaseUrl, serviceKey, local_pref);
      await saveState(supabase, phoneNorm, {
        lead_id: lead.id,
        last_intent: "oferecer_datas",
        ambiguous_count: 0,
        awaiting: "escolha_periodo",
        last_options: opcoes,
        payment_type,
        convenio,
        nome_completo,
        data_nascimento,
        selected_local: local_pref ? localFull(local_pref) : null,
        sandbox,
      });
      return replyAndLog(montarTextoOpcoes(opcoes), "oferecer_datas", {
        crm_status: "AGUARDANDO",
        awaiting: "escolha_periodo",
      });
    }

    // 18. Ambíguo
    const ambig = (state?.ambiguous_count ?? 0) + 1;
    await saveState(supabase, phoneNorm, {
      lead_id: lead.id,
      last_intent: "ambiguo",
      ambiguous_count: ambig,
      awaiting: state?.awaiting ?? null,
      last_options: state?.last_options ?? null,
      sandbox,
    });
    if (ambig >= 3) {
      await supabase
        .from("agendamentos")
        .update({ status_crm: "PRECISA_DE_HUMANO", bot_ativo: false })
        .eq("id", lead.id);
      return replyAndLog(
        "Vou pedir para nossa equipe te atender por aqui para entender melhor 🙏",
        "ambiguo",
        { needs_human: true, crm_status: "PRECISA_DE_HUMANO" },
      );
    }

    return replyAndLog(
      "Não entendi muito bem 😅 Posso te ajudar com:\n• *Agendar* uma consulta\n• Tirar dúvida sobre *endereço*\n\nO que você precisa?",
      "ambiguo",
    );
  } catch (err) {
    console.error("[hermes-webhook] erro:", err);
    return jsonResp(
      {
        ok: false,
        action: "none",
        reply_text: null,
        error: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
});
