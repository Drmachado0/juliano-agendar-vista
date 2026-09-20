import { criarLead, type LeadData } from "@/services/leads";

/**
 * Resiliência da criação de lead:
 * 1. uma segunda tentativa curta (rede 4G instável costuma passar na 2ª);
 * 2. persistência local do lead quando as duas tentativas falham;
 * 3. reenvio em segundo plano quando a pessoa volta ao site.
 *
 * Nada disso aparece para quem consegue agendar normalmente.
 */

export const PENDING_LEAD_STORAGE_KEY = "lp_pending_lead";
export const PENDING_LEAD_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 1 semana
export const LEAD_RETRY_DELAY_MS = 1500;

export interface PendingLead {
  savedAt: number;
  lead: LeadData;
}

export interface CriarLeadResiliente {
  lead_id: string | null;
  error: Error | null;
  status?: number;
  attempts: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function criarLeadComRetry(
  lead: LeadData,
  delayMs: number = LEAD_RETRY_DELAY_MS,
): Promise<CriarLeadResiliente> {
  const first = await criarLead(lead);
  if (!first.error && first.lead_id) {
    return { ...first, attempts: 1 };
  }

  await sleep(delayMs);
  const second = await criarLead(lead);
  return { ...second, attempts: 2 };
}

export function savePendingLead(lead: LeadData) {
  try {
    const payload: PendingLead = { savedAt: Date.now(), lead };
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
    const { lead_id, error } = await criarLead(pending.lead);
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
