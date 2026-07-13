// ============================================================================
// classifyNotificationResults.ts
// Helper puro (sem Deno/Supabase) para avaliar corretamente o resultado de
// Promise.allSettled sobre chamadas a supabase.functions.invoke.
//
// supabase.functions.invoke normalmente RESOLVE a Promise com { data, error }
// mesmo quando a função falhou — então checar apenas r.status === "fulfilled"
// é fail-open. Aqui classificamos como sucesso somente quando:
//   • Promise fulfilled
//   • value.error é ausente/null
//   • payload NÃO declara success === false ou sucesso === false
//
// Códigos são CATEGORIAS FIXAS E FECHADAS. Nenhum conteúdo externo
// (name/code/status/motivo/error/message) entra no `code` ou nos logs.
// ============================================================================

export interface NotificationOutcome {
  ok: boolean;
  code: "ok" | "rejected" | "invoke_error" | "payload_false";
}

/**
 * Classifica UM PromiseSettledResult vindo de supabase.functions.invoke.
 * O `value` esperado tem o formato { data, error }.
 */
export function classifyNotificationResult(
  r: PromiseSettledResult<unknown>,
): NotificationOutcome {
  if (r.status === "rejected") {
    return { ok: false, code: "rejected" };
  }
  const v: any = r.value ?? {};
  if (v && typeof v === "object" && v.error) {
    return { ok: false, code: "invoke_error" };
  }
  const payload = v?.data ?? v; // suporta clientes que retornam só o payload
  if (payload && typeof payload === "object") {
    if (payload.success === false || payload.sucesso === false) {
      return { ok: false, code: "payload_false" };
    }
  }
  return { ok: true, code: "ok" };
}

/** Classifica um array e devolve resumo agregado. */
export function classifyNotificationResults(
  results: PromiseSettledResult<unknown>[],
): { ok: boolean; outcomes: NotificationOutcome[] } {
  const outcomes = results.map(classifyNotificationResult);
  return { ok: outcomes.every((o) => o.ok), outcomes };
}
