/**
 * Normaliza dados de usuário para Enhanced Conversions (Google Ads) e
 * Advanced Matching (Meta), no formato esperado pelas tags do GTM.
 *
 * Regras padrão:
 * - email: lower, trim
 * - phone: dígitos + prefixo E.164 "+55..." (assume BR se vier sem DDI)
 * - first_name / last_name: lower, sem acentos, sem pontuação
 *
 * NUNCA envie esses campos para outros lugares além do dataLayer/GTM
 * e do fluxo n8n já existente.
 */
function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normName(s: string): string {
  return stripDiacritics((s || "").trim().toLowerCase()).replace(/[^a-z\s'-]/g, "");
}

/** Retorna telefone em E.164 BR ("+55DDDNNNNNNNN") ou "" se inválido. */
export function toE164BR(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12) {
    // already has DDI
  } else if (d.length === 10 || d.length === 11) {
    d = "55" + d;
  } else if (!d.startsWith("55")) {
    d = "55" + d;
  }
  return `+${d}`;
}

export interface LeadUserData {
  email?: string;
  phone_number?: string;
  first_name?: string;
  last_name?: string;
}

export function buildLeadUserData(input: {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
}): LeadUserData {
  const out: LeadUserData = {};
  const email = (input.email || "").trim().toLowerCase();
  if (email && email.includes("@")) out.email = email;

  const phone = toE164BR(input.phone || "");
  if (phone && phone.length >= 13) out.phone_number = phone;

  const full = normName(input.fullName || "");
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length > 0) out.first_name = parts[0];
    if (parts.length > 1) out.last_name = parts.slice(1).join(" ");
  }
  return out;
}

/**
 * Coleta UTMs/click-ids da URL atual e do sessionStorage (que já é
 * populado por captureAttribution/useAgendamentoFlow).
 */
export function collectAttribution(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
  const out: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    for (const k of keys) {
      const v = params.get(k) ?? sessionStorage.getItem(k) ?? undefined;
      if (v) out[k] = v;
    }
    // fallback: lp_agendamento_utms
    const raw = sessionStorage.getItem("lp_agendamento_utms");
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const k of keys) if (!out[k] && parsed?.[k]) out[k] = parsed[k];
    }
  } catch {
    /* noop */
  }
  return out;
}
