// ============================================================================
// telefoneCanonico.test.ts
// Prova que a normalização usada por registrar-envio-out-n8n gera
// telefone_canonico compatível com o formato armazenado em
// agendamentos.telefone_canonico (11 dígitos BR, sem DDI).
// ============================================================================
import { describe, it, expect } from "vitest";
import { telefoneCanonico, maskTelefone } from "../../../supabase/functions/_shared/telefoneCanonico.ts";

describe("telefoneCanonico — normalização BR", () => {
  // Regressão: este caso antes esperava '91991150476' — o número ANTIGO da
  // clínica — usando como entrada o número ATUAL ('5591936180476'). Os dígitos
  // do assinante não batem (9361-8047 vs 9911-5047), então a expectativa era
  // impossível: nenhuma normalização troca dígitos, ela só remove o DDI.
  it("E.164 '5591936180476' → canônico '91936180476' (remove o DDI, preserva os dígitos)", () => {
    expect(telefoneCanonico("5591936180476")).toBe("91936180476");
  });

  it("remover o DDI nunca altera DDD nem número do assinante", () => {
    for (const [entrada, esperado] of [
      ["5591936180476", "91936180476"],
      ["5591991150476", "91991150476"],
      ["+55 11 98888-7777", "11988887777"],
    ] as const) {
      expect(telefoneCanonico(entrada)).toBe(esperado);
      // o canônico é sempre um sufixo da entrada só-dígitos
      expect(entrada.replace(/\D/g, "").endsWith(esperado)).toBe(true);
    }
  });

  it("com '+' e espaços: '+55 (91) 99115-0476' → '91991150476'", () => {
    expect(telefoneCanonico("+55 (91) 99115-0476")).toBe("91991150476");
  });

  it("10 dígitos (sem 9) → adiciona 9: '9130001234' → '91930001234'", () => {
    expect(telefoneCanonico("9130001234")).toBe("91930001234");
  });

  it("já canônico permanece: '91991150476' → '91991150476'", () => {
    expect(telefoneCanonico("91991150476")).toBe("91991150476");
  });

  it("nulo/vazio → null", () => {
    expect(telefoneCanonico(null)).toBeNull();
    expect(telefoneCanonico("")).toBeNull();
    expect(telefoneCanonico("abc")).toBeNull();
  });
});

describe("maskTelefone — logs seguros", () => {
  it("mostra apenas os últimos 4 dígitos", () => {
    expect(maskTelefone("5591936180476")).toBe("****0476");
    expect(maskTelefone("+55 (91) 99115-0476")).toBe("****0476");
  });

  it("nunca vaza o número completo", () => {
    const masked = maskTelefone("5591936180476");
    expect(masked).not.toContain("991150");
    expect(masked).not.toContain("5591");
  });

  it("entrada vazia → '****'", () => {
    expect(maskTelefone(null)).toBe("****");
    expect(maskTelefone("")).toBe("****");
  });
});
