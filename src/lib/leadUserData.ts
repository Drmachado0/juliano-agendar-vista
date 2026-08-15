import { sha256 } from 'js-sha256';

/**
 * Normaliza dados de usuário para Enhanced Conversions (Google Ads) e
 * Advanced Matching (Meta), no formato esperado pelas tags do GTM.
 *
 * Regras padrão:
 * - email: lower, trim
 * - phone: dígitos + prefixo E.164 "+55..." (assume BR se vier sem DDI)
 * - first_name / last_name: lower, sem acentos, sem pontuação
 *
 * PII PROTEÇÃO:
 * Todos os dados são submetidos a SHA-256 antes de serem enviados ao dataLayer,
 * garantindo que nenhum dado sensível em texto legível fique exposto no navegador.
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

/**
 * Constrói o objeto de dados do usuário, aplicando SHA-256 em todos os campos.
 */
export function buildLeadUserData(input: {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
}): LeadUserData {
  const out: LeadUserData = {};

  const email = (input.email || "").trim().toLowerCase();
  if (email && email.includes("@")) {
    out.email = sha256(email);
  }

  const phone = toE164BR(input.phone || "");
  if (phone && phone.length >= 13) {
    // Para Meta/Google, deve-se aplicar o hash no número E.164 SEM o símbolo '+'
    out.phone_number = sha256(phone.replace(/\+/g, ""));
  }

  const full = normName(input.fullName || "");
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length > 0) out.first_name = sha256(parts[0]);
    if (parts.length > 1) out.last_name = sha256(parts.slice(1).join(" "));
  }
  
  return out;
}

/**
 * Coleta UTMs/click-ids da URL atual e do sessionStorage.
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
