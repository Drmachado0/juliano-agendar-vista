// ============================================================================
// Testes do helper puro classifyNotificationResults.
// Cobre o fail-open descoberto na auditoria: supabase.functions.invoke
// resolve a Promise mesmo em falha (value.error preenchido) e/ou o payload
// pode declarar success/sucesso=false.
//
// Códigos são CATEGORIAS FIXAS. Nenhum conteúdo externo pode aparecer no code.
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

describe("classifyNotificationResult — categorias fixas", () => {
  it("fulfilled sem error e sem payload é OK", () => {
    const o = classifyNotificationResult(fulfilled({ data: null, error: null }));
    expect(o).toEqual({ ok: true, code: "ok" });
  });

  it("fulfilled com error preenchido → 'invoke_error' exato", () => {
    const r = fulfilled({ data: null, error: { name: "FunctionsHttpError", message: "500" } });
    const o = classifyNotificationResult(r);
    expect(o).toEqual({ ok: false, code: "invoke_error" });
  });

  it("payload.success === false → 'payload_false' exato", () => {
    const r = fulfilled({ data: { success: false, motivo: "quota" }, error: null });
    const o = classifyNotificationResult(r);
    expect(o).toEqual({ ok: false, code: "payload_false" });
  });

  it("payload.sucesso === false (pt-br) → 'payload_false' exato", () => {
    const r = fulfilled({ data: { sucesso: false, motivo: "n8n_down" }, error: null });
    expect(classifyNotificationResult(r)).toEqual({ ok: false, code: "payload_false" });
  });

  it("payload success: true → ok", () => {
    const r = fulfilled({ data: { success: true }, error: null });
    expect(classifyNotificationResult(r)).toEqual({ ok: true, code: "ok" });
  });

  it("rejected → 'rejected' exato", () => {
    const o = classifyNotificationResult(rejected(new Error("boom")));
    expect(o).toEqual({ ok: false, code: "rejected" });
  });

  it("payload sem envelope data (só o próprio value) também é avaliado", () => {
    const r = fulfilled({ success: false, motivo: "x" });
    expect(classifyNotificationResult(r)).toEqual({ ok: false, code: "payload_false" });
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
    expect(r.outcomes[1].code).toBe("invoke_error");
  });

  it("um payload_false → ok=false (fail-open evitado)", () => {
    const r = classifyNotificationResults([
      fulfilled({ data: { success: true }, error: null }),
      fulfilled({ data: { success: false }, error: null }),
    ]);
    expect(r.ok).toBe(false);
  });
});

// ============================================================================
// Sanitização estrita: NENHUM conteúdo externo (motivo/telefone/nome/email/
// error.code/error.message) pode entrar no code ou nos logs.
// ============================================================================
describe("classifyNotificationResult — nenhum conteúdo externo vaza no code", () => {
  const CASES: { desc: string; payload: any; expected: NonNullable<ReturnType<typeof classifyNotificationResult>["code"]>; forbidden: string[] }[] = [
    {
      desc: "motivo = telefone puro (dígitos)",
      payload: fulfilled({ data: { success: false, motivo: "5591991300174" }, error: null }),
      expected: "payload_false",
      forbidden: ["5591991300174", "9130", "91991300174"],
    },
    {
      desc: "motivo = nome simples 'Maria'",
      payload: fulfilled({ data: { success: false, motivo: "Maria" }, error: null }),
      expected: "payload_false",
      forbidden: ["Maria"],
    },
    {
      desc: "motivo = email",
      payload: fulfilled({ data: { success: false, motivo: "paciente@example.com" }, error: null }),
      expected: "payload_false",
      forbidden: ["paciente@example.com", "@example", "paciente"],
    },
    {
      desc: "error.code arbitrário com token interno",
      payload: fulfilled({ data: null, error: { code: "PGRST_SECRET_ABC123", message: "senha=abc" } }),
      expected: "invoke_error",
      forbidden: ["PGRST_SECRET_ABC123", "abc123", "senha", "abc"],
    },
    {
      desc: "error.message com telefone/PII",
      payload: fulfilled({ data: null, error: { name: "FunctionsHttpError", message: "Timeout 5591991300174 João" } }),
      expected: "invoke_error",
      forbidden: ["5591991300174", "João", "Timeout", "FunctionsHttpError"],
    },
    {
      desc: "rejected com Error contendo PII",
      payload: rejected(new Error("Paciente Maria 91999999999")),
      expected: "rejected",
      forbidden: ["Maria", "91999999999", "Paciente", "Error"],
    },
    {
      desc: "rejected com string bruta contendo PII",
      payload: rejected("telefone 5591991300174 falhou"),
      expected: "rejected",
      forbidden: ["5591991300174", "telefone", "falhou"],
    },
    {
      desc: "payload.error com objeto complexo",
      payload: fulfilled({ data: { success: false, error: { name: "SecretLeak", message: "TOKEN_XYZ" } }, error: null }),
      expected: "payload_false",
      forbidden: ["SecretLeak", "TOKEN_XYZ", "TOKEN"],
    },
  ];

  for (const c of CASES) {
    it(`${c.desc} → code fixo '${c.expected}', sem vazar dados`, () => {
      const o = classifyNotificationResult(c.payload);
      expect(o.code).toBe(c.expected);
      for (const bad of c.forbidden) {
        expect(o.code).not.toContain(bad);
      }
      // code deve pertencer ao conjunto fechado
      expect(["ok", "rejected", "invoke_error", "payload_false"]).toContain(o.code);
    });
  }
});
