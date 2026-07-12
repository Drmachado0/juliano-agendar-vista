/**
 * Constrói uma URL para /agendamento preservando UTMs externas já presentes
 * na URL atual e acrescentando parâmetros internos (não sobrescreve UTMs
 * existentes). Não inclui dados sensíveis nem médicos.
 *
 * Uso: buildAgendamentoLink({ utm_content: "hero", campaign: "paragominas" }).
 */
export interface AgendamentoLinkOptions {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  /** Parâmetros internos adicionais (não médicos, não PII). */
  extra?: Record<string, string>;
}

const INTERNAL_DEFAULTS = {
  utm_source: "site",
  utm_medium: "landing",
  utm_campaign: "paragominas",
} as const;

export function buildAgendamentoLink(opts: AgendamentoLinkOptions = {}): string {
  const params = new URLSearchParams();

  // 1) Copia UTMs já presentes na URL do navegador — não sobrescreve.
  if (typeof window !== "undefined") {
    const current = new URLSearchParams(window.location.search);
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"]) {
      const v = current.get(key);
      if (v) params.set(key, v);
    }
  }

  // 2) Aplica defaults internos APENAS quando o parâmetro ainda não existe.
  const merged: Record<string, string | undefined> = {
    utm_source: opts.utm_source ?? INTERNAL_DEFAULTS.utm_source,
    utm_medium: opts.utm_medium ?? INTERNAL_DEFAULTS.utm_medium,
    utm_campaign: opts.utm_campaign ?? INTERNAL_DEFAULTS.utm_campaign,
    utm_content: opts.utm_content,
    utm_term: opts.utm_term,
    ...(opts.extra ?? {}),
  };

  for (const [k, v] of Object.entries(merged)) {
    if (!v) continue;
    if (!params.has(k)) params.set(k, v);
  }

  const qs = params.toString();
  return qs ? `/agendamento?${qs}` : "/agendamento";
}
