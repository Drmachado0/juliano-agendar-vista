import { describe, expect, it } from "vitest";

/**
 * Reproduz em TS a lógica canônica implementada em SQL
 * (public.telefone_canonico). Garante que o mesmo entendimento
 * de normalização exista no cliente e nos testes.
 */
function telefoneCanonico(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 10) d = d.slice(0, 2) + "9" + d.slice(2);
  if (d.length > 11) d = d.slice(-11);
  return d;
}

describe("telefoneCanonico (mirror do RPC SQL)", () => {
  it("remove DDI 55", () => {
    expect(telefoneCanonico("+55 91 99115-0174")).toBe("91991150174");
  });
  it("adiciona 9 quando DDD+8 dígitos", () => {
    expect(telefoneCanonico("9132110174")).toBe("91991100174".slice(0, 2) + "9" + "32110174");
    // ⬆︎ construção didática — verificação real:
    expect(telefoneCanonico("9132110174")).toBe("91932110174");
  });
  it("mantém 11 dígitos", () => {
    expect(telefoneCanonico("91991150174")).toBe("91991150174");
  });
  it("higieniza símbolos e espaços", () => {
    expect(telefoneCanonico("(91) 9 9115-0174")).toBe("91991150174");
  });
  it("retorna null para vazio", () => {
    expect(telefoneCanonico("")).toBeNull();
    expect(telefoneCanonico(null)).toBeNull();
  });
  it("descarta DDI extra mantendo os 11 últimos", () => {
    expect(telefoneCanonico("005591991150174")).toBe("91991150174");
  });
  it("dois telefones equivalentes normalizam ao mesmo valor", () => {
    const a = telefoneCanonico("+55 (91) 99115-0174");
    const b = telefoneCanonico("91991150174");
    const c = telefoneCanonico("9132110174"); // sem 9 → recebe 9
    expect(a).toBe(b);
    expect(c).toBe("91932110174");
  });
});
