// ============================================================================
// sanitizeOptionalFields.ts
// Helpers PUROS (sem Deno) para higienizar payloads vindos do n8n/ManyChat/$fromAI.
//
// Motivação (bug 2026-07-13, lead c08…):
//   Campos opcionais do $fromAI podem chegar como strings literais "undefined",
//   "null", "n/a", vazias ou só espaços. O backend precisa tratá-las como
//   AUSENTES e jamais gravá-las (ex.: sobrescrever "Juliano Machado" por "undefined").
// ============================================================================

const PLACEHOLDERS = new Set(["undefined", "null", "n/a", "na", "none", "nil", "-"]);

/** Retorna string limpa se for utilizável; senão null. */
export function sanitizeOptionalText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") {
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return null;
  }
  const trimmed = v.trim();
  if (trimmed.length === 0) return null;
  if (PLACEHOLDERS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

/** Nome só é válido com >=2 chars, contém letra e não é placeholder. */
export function sanitizeNomeCompleto(v: unknown): string | null {
  const t = sanitizeOptionalText(v);
  if (!t) return null;
  if (t.length < 2) return null;
  if (!/\p{L}/u.test(t)) return null; // exige ao menos uma letra
  return t;
}

/** Data ISO YYYY-MM-DD válida no calendário. */
export function sanitizeDataNascimento(v: unknown): string | null {
  const t = sanitizeOptionalText(v);
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, d] = t.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return t;
}

export interface RawOptionalPayload {
  nome_completo?: unknown;
  convenio?: unknown;
  tipo_atendimento?: unknown;
  local_atendimento?: unknown;
  detalhe_exame_ou_cirurgia?: unknown;
  observacoes_internas?: unknown;
  data_nascimento?: unknown;
  estado_atendimento?: unknown;
}

export interface SanitizedOptionalPayload {
  nome_completo?: string;
  convenio?: string;
  tipo_atendimento?: string;
  local_atendimento?: string;
  detalhe_exame_ou_cirurgia?: string;
  observacoes_internas?: string;
  data_nascimento?: string;
  estado_atendimento?: string;
}

export interface SanitizeResult {
  clean: SanitizedOptionalPayload;
  ignorados: string[]; // campos que vieram no payload mas foram descartados
}

/**
 * Aplica sanitização por campo. Só inclui em `clean` o que passou.
 * `ignorados` lista chaves presentes no payload cujo valor foi rejeitado.
 */
export function sanitizeOptionalPayload(raw: RawOptionalPayload): SanitizeResult {
  const clean: SanitizedOptionalPayload = {};
  const ignorados: string[] = [];

  const putText = (key: keyof SanitizedOptionalPayload, val: unknown) => {
    if (val === undefined) return; // nem veio no payload
    const t = sanitizeOptionalText(val);
    if (t) clean[key] = t;
    else ignorados.push(key);
  };

  if (raw.nome_completo !== undefined) {
    const n = sanitizeNomeCompleto(raw.nome_completo);
    if (n) clean.nome_completo = n;
    else ignorados.push("nome_completo");
  }

  putText("convenio", raw.convenio);
  putText("tipo_atendimento", raw.tipo_atendimento);
  putText("local_atendimento", raw.local_atendimento);
  putText("detalhe_exame_ou_cirurgia", raw.detalhe_exame_ou_cirurgia);
  putText("observacoes_internas", raw.observacoes_internas);
  putText("estado_atendimento", raw.estado_atendimento);

  if (raw.data_nascimento !== undefined) {
    const d = sanitizeDataNascimento(raw.data_nascimento);
    if (d) clean.data_nascimento = d;
    else ignorados.push("data_nascimento");
  }

  return { clean, ignorados };
}
