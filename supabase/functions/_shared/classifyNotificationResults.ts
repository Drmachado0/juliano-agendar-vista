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
// ============================================================================

export interface NotificationOutcome {
  ok: boolean;
  code: string; // categoria sanitizada, sem PII
}

// Allowlist estrita: identificadores curtos (letras/dígitos/_.:-), sem espaços,
// sem caracteres livres, para GARANTIR que nenhum texto de erro/motivo/telefone
// vaze nos logs. Qualquer coisa fora disso vira a categoria fixa "reported_failure".
const SAFE_CODE_RE = /^[A-Za-z0-9_.:-]{1,64}$/;

/** Sanitiza um valor para virar um código de log seguro (allowlist). */
function safeCode(x: unknown): string {
  if (x == null) return "unknown";
  const raw =
    typeof x === "string"
      ? x
      : typeof x === "object"
      ? String(
          (x as any).name ??
            (x as any).code ??
            (x as any).status ??
            "reported_failure",
        )
      : "unknown";
  return SAFE_CODE_RE.test(raw) ? raw : "reported_failure";
}

/**
 * Classifica UM PromiseSettledResult vindo de supabase.functions.invoke.
 * O `value` esperado tem o formato { data, error }.
 */
export function classifyNotificationResult(
  r: PromiseSettledResult<unknown>,
): NotificationOutcome {
  if (r.status === "rejected") {
    return { ok: false, code: `rejected:${safeCode((r as any).reason)}` };
  }
  const v: any = r.value ?? {};
  if (v && typeof v === "object" && v.error) {
    return { ok: false, code: `invoke_error:${safeCode(v.error)}` };
  }
  const payload = v?.data ?? v; // suporta clientes que retornam só o payload
  if (payload && typeof payload === "object") {
    if (payload.success === false || payload.sucesso === false) {
      const motivo = safeCode(payload.motivo ?? payload.error ?? "payload_false");
      return { ok: false, code: `payload_false:${motivo}` };
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
