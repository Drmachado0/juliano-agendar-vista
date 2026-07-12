// ============================================================================
// telefoneCanonico.ts
// Espelho em TS da função SQL public.telefone_canonico(text) para uso nas
// Edge Functions quando a RPC não está disponível (fallback determinístico).
// Também expõe maskTelefone para logs seguros (somente últimos 4 dígitos).
// ============================================================================

export function telefoneCanonico(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = String(input).replace(/\D/g, "");
  if (d.length === 0) return null;
  // remove DDI 55 se presente
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  // Brasil: DDD (2) + número (8 ou 9). Adiciona 9 quando ficou 10 dígitos.
  if (d.length === 10) d = d.slice(0, 2) + "9" + d.slice(2);
  // fallback: fica com os últimos 11
  if (d.length > 11) d = d.slice(-11);
  return d;
}

export function maskTelefone(input: string | null | undefined): string {
  const d = String(input ?? "").replace(/\D/g, "");
  if (!d) return "****";
  return `****${d.slice(-4)}`;
}
