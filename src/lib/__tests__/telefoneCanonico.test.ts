// ============================================================================
// telefoneCanonico.test.ts
// Prova que a normalização usada por registrar-envio-out-n8n gera
// telefone_canonico compatível com o formato armazenado em
// agendamentos.telefone_canonico (11 dígitos BR, sem DDI).
// ============================================================================
import { describe, it, expect } from "vitest";
import { telefoneCanonico, maskTelefone } from "../../../supabase/functions/_shared/telefoneCanonico.ts";

describe("telefoneCanonico — normalização BR", () => {
  it("E.164 '5591991150174' → canônico '91991150174'", () => {
    expect(telefoneCanonico("5591991150174")).toBe("91991150174");
  });

  it("com '+' e espaços: '+55 (91) 99115-0174' → '91991150174'", () => {
    expect(telefoneCanonico("+55 (91) 99115-0174")).toBe("91991150174");
  });

  it("10 dígitos (sem 9) → adiciona 9: '9130001234' → '91930001234'", () => {
    expect(telefoneCanonico("9130001234")).toBe("91930001234");
  });

  it("já canônico permanece: '91991150174' → '91991150174'", () => {
    expect(telefoneCanonico("91991150174")).toBe("91991150174");
  });

  it("nulo/vazio → null", () => {
    expect(telefoneCanonico(null)).toBeNull();
    expect(telefoneCanonico("")).toBeNull();
    expect(telefoneCanonico("abc")).toBeNull();
  });
});

describe("maskTelefone — logs seguros", () => {
  it("mostra apenas os últimos 4 dígitos", () => {
    expect(maskTelefone("5591991150174")).toBe("****0174");
    expect(maskTelefone("+55 (91) 99115-0174")).toBe("****0174");
  });

  it("nunca vaza o número completo", () => {
    const masked = maskTelefone("5591991150174");
    expect(masked).not.toContain("991150");
    expect(masked).not.toContain("5591");
  });

  it("entrada vazia → '****'", () => {
    expect(maskTelefone(null)).toBe("****");
    expect(maskTelefone("")).toBe("****");
  });
});
