import { describe, it, expect } from "vitest";
import {
  detectarValorConsulta,
  reforcarProximoDadoPendente,
  VALOR_CONSULTA_REPLY,
  VALOR_CONSULTA_TEXTO,
} from "../../../supabase/functions/_shared/respostasImediatasGuard";

describe("detectarValorConsulta — positivos", () => {
  it.each([
    "Qual o valor?",
    "qual o valor da consulta?",
    "quanto é a consulta?",
    "consulta custa quanto?",
    "quanto custa uma avaliação?",
    "quanto fica o atendimento particular?",
    "preço da consulta?",
    "valor?",
  ])("detecta: %j", (t) => {
    expect(detectarValorConsulta(t).matched).toBe(true);
  });

  it("resposta contém R$ 300,00", () => {
    const r = detectarValorConsulta("quanto custa a consulta?");
    expect(r.matched).toBe(true);
    if (r.matched) expect(r.reply).toContain(VALOR_CONSULTA_TEXTO);
    expect(VALOR_CONSULTA_REPLY).toContain("Dr. Juliano Machado");
  });
});

describe("detectarValorConsulta — falsos positivos", () => {
  it.each([
    "quanto custa a cirurgia de catarata?",
    "valor do exame de OCT?",
    "quanto é a lente intraocular?",
    "obrigada!",
    "posso ir amanhã?",
    "meu convênio é Bradesco",
  ])("NÃO detecta: %j", (t) => {
    expect(detectarValorConsulta(t).matched).toBe(false);
  });
});

describe("reforcarProximoDadoPendente", () => {
  it("acrescenta pergunta de retomada se houver", () => {
    const out = reforcarProximoDadoPendente(VALOR_CONSULTA_REPLY, "Podemos seguir? Só faltou o convênio.");
    expect(out).toContain(VALOR_CONSULTA_TEXTO);
    expect(out).toContain("faltou o convênio");
  });
  it("não altera se não houver pendência", () => {
    expect(reforcarProximoDadoPendente(VALOR_CONSULTA_REPLY, null)).toBe(VALOR_CONSULTA_REPLY);
  });
});
