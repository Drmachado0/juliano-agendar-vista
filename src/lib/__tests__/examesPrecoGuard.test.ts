import { describe, it, expect } from "vitest";
import {
  classificarExamePreco,
  composePatientReplyPrecoExame,
  replyPrecoExameTabelado,
  REPLY_EXAME_NAO_INFORMADO,
  VALOR_EXAME_TABELADO_TEXTO,
} from "../../../supabase/functions/_shared/examesPrecoGuard";
import { PROXIMO_DADO_POR_ESTADO } from "../../../supabase/functions/_shared/respostasImediatasGuard";
import { detectarAssuntoExames } from "../../../supabase/functions/_shared/handoffExamesGuard";

describe("classificarExamePreco — preço dos 4 exames tabelados", () => {
  it.each([
    ["quanto custa a retinografia?", "retinografia"],
    ["Valor do MAPEAMENTO DE RETINA", "mapeamento de retina"],
    ["preço da biometria", "biometria"],
    ["Qual o valor da paquimetria?", "paquimetria"],
    // sem acento / caixas variadas
    ["quanto custa Paquimetria", "paquimetria"],
    ["Qual o preço do mapeamento?", "mapeamento de retina"],
  ])("%j -> preco_tabelado %s", (texto, exame) => {
    const r = classificarExamePreco(texto);
    expect(r.kind).toBe("preco_tabelado");
    if (r.kind === "preco_tabelado") expect(r.exame).toBe(exame);
  });
});

describe("classificarExamePreco — nome isolado do exame tabelado", () => {
  it.each(["retinografia", "Retinografia", "biometria", "paquimetria", "mapeamento de retina"])(
    "%j -> preco_tabelado",
    (t) => {
      expect(classificarExamePreco(t).kind).toBe("preco_tabelado");
    },
  );
});

describe("classificarExamePreco — pergunta genérica sem exame", () => {
  it.each([
    "qual o valor do exame?",
    "quanto custa o exame?",
    "preço do exame?",
  ])("%j -> preco_generico_sem_exame", (t) => {
    expect(classificarExamePreco(t).kind).toBe("preco_generico_sem_exame");
  });
});

describe("classificarExamePreco — exames NÃO tabelados / handoff", () => {
  it.each([
    "quanto custa o OCT?",
    "valor da tomografia",
    "preço do campo visual",
    "quanto é a topografia?",
    "valor de ultrassom ocular",
    "quanto custa uma microscopia?",
  ])("%j -> handoff_exame_nao_tabelado", (t) => {
    expect(classificarExamePreco(t).kind).toBe("handoff_exame_nao_tabelado");
  });
});

describe("classificarExamePreco — não é preço, é contexto operacional", () => {
  it.each([
    "resultado da retinografia",
    "agendar retinografia",
    "convênio cobre retinografia?",
    "preparo da paquimetria",
    "onde faço a biometria?",
    "quero remarcar a retinografia",
    "laudo do mapeamento",
  ])("%j -> none (handoff HGP assume)", (t) => {
    expect(classificarExamePreco(t).kind).toBe("none");
  });
});

describe("classificarExamePreco — falsos positivos", () => {
  it("ecobiometria NÃO casa como biometria tabelada", () => {
    expect(classificarExamePreco("quanto custa a ecobiometria?").kind).toBe(
      "handoff_exame_nao_tabelado",
    );
  });
  it("valor da consulta não vira exame", () => {
    expect(classificarExamePreco("qual o valor da consulta?").kind).toBe("none");
  });
  it("exame de consciência (sem exame ocular)", () => {
    expect(classificarExamePreco("fiz exame de consciência").kind).toBe("none");
  });
});

describe("composePatientReplyPrecoExame — retomada por estado", () => {
  it("adiciona próximo dado quando estado é conhecido", () => {
    const r = composePatientReplyPrecoExame(
      "retinografia",
      "coletando_nome",
      PROXIMO_DADO_POR_ESTADO,
    );
    expect(r.reply).toContain("retinografia");
    expect(r.reply).toContain(VALOR_EXAME_TABELADO_TEXTO);
    expect(r.reply).toContain(PROXIMO_DADO_POR_ESTADO.coletando_nome);
    expect(r.hasRetomada).toBe(true);
  });

  it("apenas frase fixa quando estado desconhecido", () => {
    const r = composePatientReplyPrecoExame("biometria", null, PROXIMO_DADO_POR_ESTADO);
    expect(r.reply).toBe(replyPrecoExameTabelado("biometria"));
    expect(r.hasRetomada).toBe(false);
  });
});

describe("REPLY_EXAME_NAO_INFORMADO", () => {
  it("pede o nome do exame", () => {
    expect(REPLY_EXAME_NAO_INFORMADO).toMatch(/Qual exame/i);
  });
});

// Precedência: um caso de handoff HGP não pode ser resolvido por preço tabelado.
describe("integração — handoff genérico continua funcionando", () => {
  it("'preciso agendar exame de OCT' cai em handoff (não é preço)", () => {
    expect(classificarExamePreco("preciso agendar exame de OCT").kind).toBe("none");
    const r = detectarAssuntoExames("preciso agendar exame de OCT", []);
    expect(r.matched).toBe(true);
    expect(r.reason).toBe("exame_avaliacao_hgp");
  });
});
