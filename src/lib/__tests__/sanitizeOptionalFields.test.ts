import { describe, it, expect } from "vitest";
import {
  sanitizeOptionalText,
  sanitizeNomeCompleto,
  sanitizeDataNascimento,
  sanitizeOptionalPayload,
} from "../../../supabase/functions/_shared/sanitizeOptionalFields";

describe("sanitizeOptionalText", () => {
  it.each([
    ["undefined", null],
    ["UNDEFINED", null],
    ["null", null],
    ["Null", null],
    ["n/a", null],
    ["N/A", null],
    ["", null],
    ["   ", null],
    ["  Juliano ", "Juliano"],
    ["Bradesco", "Bradesco"],
  ])("normaliza %j -> %j", (input, expected) => {
    expect(sanitizeOptionalText(input)).toBe(expected);
  });

  it("nao aceita undefined/null nativos", () => {
    expect(sanitizeOptionalText(undefined)).toBeNull();
    expect(sanitizeOptionalText(null)).toBeNull();
  });
});

describe("sanitizeNomeCompleto", () => {
  it("preserva nome real", () => {
    expect(sanitizeNomeCompleto("Juliano Machado")).toBe("Juliano Machado");
  });
  it("rejeita placeholders e curtos", () => {
    expect(sanitizeNomeCompleto("undefined")).toBeNull();
    expect(sanitizeNomeCompleto("null")).toBeNull();
    expect(sanitizeNomeCompleto("n/a")).toBeNull();
    expect(sanitizeNomeCompleto("  ")).toBeNull();
    expect(sanitizeNomeCompleto("A")).toBeNull();
    expect(sanitizeNomeCompleto("12")).toBeNull(); // sem letras
  });
});

describe("sanitizeDataNascimento", () => {
  it("aceita ISO válido", () => {
    expect(sanitizeDataNascimento("1985-04-12")).toBe("1985-04-12");
  });
  it("rejeita placeholders e formatos ruins", () => {
    expect(sanitizeDataNascimento("undefined")).toBeNull();
    expect(sanitizeDataNascimento("12/04/1985")).toBeNull();
    expect(sanitizeDataNascimento("2020-13-01")).toBeNull(); // mês inválido
    expect(sanitizeDataNascimento("2020-02-30")).toBeNull(); // dia inválido
  });
});

describe("sanitizeOptionalPayload — cenário real bug 91991300174", () => {
  it("nome_completo='undefined' é IGNORADO (não sobrescreve Juliano Machado)", () => {
    const { clean, ignorados } = sanitizeOptionalPayload({
      nome_completo: "undefined",
      convenio: "Particular",
    });
    expect(clean.nome_completo).toBeUndefined();
    expect(clean.convenio).toBe("Particular");
    expect(ignorados).toContain("nome_completo");
    expect(ignorados).not.toContain("convenio");
  });

  it("mix de placeholders/válidos separa corretamente", () => {
    const { clean, ignorados } = sanitizeOptionalPayload({
      nome_completo: "Juliano Machado",
      convenio: "null",
      tipo_atendimento: "  ",
      local_atendimento: "Belém (IOB / Vitria)",
      detalhe_exame_ou_cirurgia: "n/a",
      observacoes_internas: "  paciente confirmou  ",
      data_nascimento: "undefined",
      estado_atendimento: "aguardando_confirmacao",
    });
    expect(clean).toEqual({
      nome_completo: "Juliano Machado",
      local_atendimento: "Belém (IOB / Vitria)",
      observacoes_internas: "paciente confirmou",
      estado_atendimento: "aguardando_confirmacao",
    });
    expect(ignorados.sort()).toEqual(
      ["convenio", "tipo_atendimento", "detalhe_exame_ou_cirurgia", "data_nascimento"].sort(),
    );
  });

  it("payload vazio → clean vazio, ignorados vazio", () => {
    const { clean, ignorados } = sanitizeOptionalPayload({});
    expect(clean).toEqual({});
    expect(ignorados).toEqual([]);
  });

  it("payload só com telefone (nada opcional) não gera ignorados", () => {
    const { clean, ignorados } = sanitizeOptionalPayload({
      // nenhum opcional
    } as any);
    expect(clean).toEqual({});
    expect(ignorados).toEqual([]);
  });

  it("data_nascimento válida passa", () => {
    const { clean, ignorados } = sanitizeOptionalPayload({ data_nascimento: "1985-04-12" });
    expect(clean.data_nascimento).toBe("1985-04-12");
    expect(ignorados).toEqual([]);
  });
});
