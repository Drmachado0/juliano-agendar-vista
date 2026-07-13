// ============================================================================
// Testes do helper puro classifyNotificationResults.
// Cobre o fail-open descoberto na auditoria: supabase.functions.invoke
// resolve a Promise mesmo em falha (value.error preenchido) e/ou o payload
// pode declarar success/sucesso=false.
// ============================================================================
import { describe, it, expect } from "vitest";
import {
  classifyNotificationResult,
  classifyNotificationResults,
} from "../../../supabase/functions/_shared/classifyNotificationResults.ts";

function fulfilled<T>(value: T): PromiseSettledResult<T> {
  return { status: "fulfilled", value } as PromiseSettledResult<T>;
}
function rejected(reason: unknown): PromiseSettledResult<never> {
  return { status: "rejected", reason } as PromiseSettledResult<never>;
}

describe("classifyNotificationResult", () => {
  it("fulfilled sem error e sem payload é OK", () => {
    expect(classifyNotificationResult(fulfilled({ data: null, error: null })).ok).toBe(true);
  });

  it("fulfilled com error preenchido → falha (fail-closed)", () => {
    const r = fulfilled({ data: null, error: { name: "FunctionsHttpError", message: "500" } });
    const o = classifyNotificationResult(r);
    expect(o.ok).toBe(false);
    expect(o.code).toMatch(/invoke_error:/);
    // sanitizado — sem message/PII vazando
    expect(o.code).not.toMatch(/500/);
  });

  it("payload.success === false → falha", () => {
    const r = fulfilled({ data: { success: false, motivo: "quota" }, error: null });
    const o = classifyNotificationResult(r);
    expect(o.ok).toBe(false);
    expect(o.code).toMatch(/payload_false:quota/);
  });

  it("payload.sucesso === false (pt-br) → falha", () => {
    const r = fulfilled({ data: { sucesso: false, motivo: "n8n_down" }, error: null });
    expect(classifyNotificationResult(r).ok).toBe(false);
  });

  it("payload success: true → ok", () => {
    const r = fulfilled({ data: { success: true }, error: null });
    expect(classifyNotificationResult(r).ok).toBe(true);
  });

  it("rejected → falha com prefixo 'rejected:'", () => {
    const o = classifyNotificationResult(rejected(new Error("boom")));
    expect(o.ok).toBe(false);
    expect(o.code).toMatch(/^rejected:/);
    expect(o.code).not.toMatch(/boom/);
  });

  it("payload sem envelope data (só o próprio value) também é avaliado", () => {
    const r = fulfilled({ success: false, motivo: "x" });
    expect(classifyNotificationResult(r).ok).toBe(false);
  });
});

describe("classifyNotificationResults (agregado)", () => {
  it("todos OK → ok=true", () => {
    const r = classifyNotificationResults([
      fulfilled({ data: { success: true }, error: null }),
      fulfilled({ data: null, error: null }),
    ]);
    expect(r.ok).toBe(true);
  });

  it("um invoke_error → ok=false", () => {
    const r = classifyNotificationResults([
      fulfilled({ data: null, error: null }),
      fulfilled({ data: null, error: { name: "X" } }),
    ]);
    expect(r.ok).toBe(false);
    expect(r.outcomes[1].code).toMatch(/invoke_error/);
  });

  it("um payload_false → ok=false (fail-open evitado)", () => {
    const r = classifyNotificationResults([
      fulfilled({ data: { success: true }, error: null }),
      fulfilled({ data: { success: false }, error: null }),
    ]);
    expect(r.ok).toBe(false);
  });
});

describe("classifyNotificationResult — sanitização estrita (sem PII nos logs)", () => {
  it("motivo com nome do paciente vira 'reported_failure' (não vaza texto)", () => {
    const r = fulfilled({
      data: {
        success: false,
        motivo: "Falha ao enviar para João da Silva (91) 99130-0174",
      },
      error: null,
    });
    const o = classifyNotificationResult(r);
    expect(o.ok).toBe(false);
    expect(o.code).toBe("payload_false:reported_failure");
    expect(o.code).not.toMatch(/João|Silva|9130|91\)/);
  });

  it("error.message com telefone/frase não aparece no code", () => {
    const r = fulfilled({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Timeout ao contatar 5591991300174 - conteúdo bruto",
      },
    });
    const o = classifyNotificationResult(r);
    expect(o.code).toBe("invoke_error:FunctionsHttpError");
    expect(o.code).not.toMatch(/5591991300174|Timeout|conteúdo/);
  });

  it("rejected com Error contendo PII no message → 'rejected:Error' (sem texto)", () => {
    const o = classifyNotificationResult(rejected(new Error("Paciente Maria 91999999999")));
    expect(o.code).toBe("rejected:Error");
    expect(o.code).not.toMatch(/Maria|999999999/);
  });

  it("motivo com espaço/pontuação livre é rejeitado pela allowlist", () => {
    const r = fulfilled({ data: { success: false, motivo: "n8n down: quota exceeded!" }, error: null });
    expect(classifyNotificationResult(r).code).toBe("payload_false:reported_failure");
  });

  it("motivo em formato slug seguro é preservado", () => {
    const r = fulfilled({ data: { success: false, motivo: "n8n_down" }, error: null });
    expect(classifyNotificationResult(r).code).toBe("payload_false:n8n_down");
  });
});
