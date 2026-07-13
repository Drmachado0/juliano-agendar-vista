// ============================================================================
// statusTerminais.ts
// Helpers puros compartilhados por endpoints que precisam distinguir registros
// "ativos" de terminais/sandbox. Sem dependência de Deno/Supabase para permitir
// import em testes unitários TS puros.
// ============================================================================

export const TERMINAIS_CRM = ["ATENDIDO", "CANCELADO", "COMPAREceu".toUpperCase()];
export const TERMINAIS_FUNIL = ["cancelado", "compareceu", "faltou"];

export function isCrmTerminal(status: string | null | undefined): boolean {
  return TERMINAIS_CRM.includes(String(status ?? "").toUpperCase());
}
export function isFunilTerminal(status: string | null | undefined): boolean {
  return TERMINAIS_FUNIL.includes(String(status ?? "").toLowerCase());
}
export interface RegistroAgendamentoLike {
  is_sandbox?: boolean | null;
  status_crm?: string | null;
  status_funil?: string | null;
}
export function isRegistroAtivo(r: RegistroAgendamentoLike): boolean {
  if (r.is_sandbox === true) return false;
  if (isCrmTerminal(r.status_crm)) return false;
  if (isFunilTerminal(r.status_funil)) return false;
  return true;
}
