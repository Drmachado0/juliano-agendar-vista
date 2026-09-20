import { criarLead, type LeadData } from "@/services/leads";

/**
 * Resiliência da criação de lead:
 * 1. uma segunda tentativa curta (rede 4G instável costuma passar na 2ª);
 * 2. persistência local do lead quando as duas tentativas falham;
 * 3. reenvio em segundo plano quando a pessoa volta ao site.
 *
 * Toda tentativa carrega o mesmo `event_id`. O servidor usa esse identificador
 * para não inserir duas vezes: quando a gravação deu certo mas a resposta se
 * perdeu, a repetição devolve o lead que já existe em vez de criar um segundo.
 *
 * Nada disso aparece para quem consegue agendar normalmente.
 */

export const PENDING_LEAD_STORAGE_KEY = "lp_pending_lead";
export const PENDING_LEAD_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 1 semana
export const LEAD_RETRY_DELAY_MS = 1500;

/**
 * Só o necessário para recriar o lead e montar a mensagem de WhatsApp.
 * E-mail e data de nascimento ficam DE FORA de propósito: num celular
 * compartilhado esses dados ficariam acessíveis por uma semana sem precisar.
 */
export type PendingLeadData = Pick<
  LeadData,
  | "nome_completo"
  | "telefone_whatsapp"
  | "tipo_atendimento"
  | "detalhe_exame_ou_cirurgia"
  | "local_atendimento"
  | "convenio"
  | "convenio_outro"
  | "event_id"
>;

export interface PendingLead {
  savedAt: number;
  lead: PendingLeadData;
}

export interface CriarLeadResiliente {
  lead_id: string | null;
  error: Error | null;
  status?: number;
  attempts: number;
  /** O lead efetivamente enviado, já com o event_id fixado. */
  lead: LeadData;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Identificador único da tentativa de agendamento, reusado em toda repetição. */
export function novoLeadEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** 4xx não melhora na segunda tentativa — só atrasa a pessoa em 1,5s. */
function valeTentarDeNovo(status?: number): boolean {
  return !(typeof status === "number" && status >= 400 && status < 500);
}

export async function criarLeadComRetry(
  lead: LeadData,
  delayMs: number = LEAD_RETRY_DELAY_MS,
): Promise<CriarLeadResiliente> {
  const leadComId: LeadData = { ...lead, event_id: lead.event_id || novoLeadEventId() };

  const first = await criarLead(leadComId);
  if ((!first.error && first.lead_id) || !valeTentarDeNovo(first.status)) {
    return { ...first, attempts: 1, lead: leadComId };
  }

  await sleep(delayMs);
  const second = await criarLead(leadComId);
  return { ...second, attempts: 2, lead: leadComId };
}

export function toPendingLeadData(lead: LeadData): PendingLeadData {
  return {
    nome_completo: lead.nome_completo,
    telefone_whatsapp: lead.telefone_whatsapp,
    tipo_atendimento: lead.tipo_atendimento,
    detalhe_exame_ou_cirurgia: lead.detalhe_exame_ou_cirurgia ?? null,
    local_atendimento: lead.local_atendimento,
    convenio: lead.convenio,
    convenio_outro: lead.convenio_outro ?? null,
    event_id: lead.event_id ?? null,
  };
}

export function savePendingLead(lead: LeadData) {
  try {
    const payload: PendingLead = { savedAt: Date.now(), lead: toPendingLeadData(lead) };
    localStorage.setItem(PENDING_LEAD_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("[leadRecovery] Não foi possível guardar o lead localmente:", e);
  }
}

export function loadPendingLead(): PendingLead | null {
  try {
    const raw = localStorage.getItem(PENDING_LEAD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingLead;
    if (!parsed?.lead?.telefone_whatsapp || typeof parsed.savedAt !== "number") {
      clearPendingLead();
      return null;
    }
    if (Date.now() - parsed.savedAt > PENDING_LEAD_MAX_AGE_MS) {
      clearPendingLead();
      return null;
    }
    return parsed;
  } catch {
    clearPendingLead();
    return null;
  }
}

export function clearPendingLead() {
  try {
    localStorage.removeItem(PENDING_LEAD_STORAGE_KEY);
  } catch {
    /* storage indisponível */
  }
}

/** Reenvia em segundo plano o lead guardado. Silencioso por definição. */
export async function retryPendingLead(): Promise<boolean> {
  const pending = loadPendingLead();
  if (!pending) return false;
  try {
    // Mesmo event_id da tentativa original: se o lead já existe no banco, o
    // servidor devolve o id existente e nada é duplicado.
    const { lead_id, error } = await criarLead(pending.lead as LeadData);
    if (!error && lead_id) {
      clearPendingLead();
      return true;
    }
  } catch (e) {
    console.warn("[leadRecovery] Reenvio em segundo plano falhou:", e);
  }
  return false;
}

export interface FallbackContato {
  nome?: string;
  telefone?: string;
  tipoAtendimento?: string;
  local?: string;
  convenio?: string;
  data?: string;
  hora?: string;
}

/** Mensagem de WhatsApp com tudo que a pessoa já preencheu. */
export function buildFallbackWhatsAppMessage(dados: FallbackContato): string {
  const linhas = [
    "Olá! Tentei agendar pelo site e não consegui concluir. Seguem meus dados:",
    dados.nome ? `Nome: ${dados.nome}` : null,
    dados.telefone ? `WhatsApp: ${dados.telefone}` : null,
    dados.tipoAtendimento ? `Atendimento: ${dados.tipoAtendimento}` : null,
    dados.local ? `Local: ${dados.local}` : null,
    dados.convenio ? `Convênio: ${dados.convenio}` : null,
    dados.data ? `Data desejada: ${dados.data}` : null,
    dados.hora ? `Horário desejado: ${dados.hora}` : null,
  ].filter(Boolean);
  return linhas.join("\n");
}
