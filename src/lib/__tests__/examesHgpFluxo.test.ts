/**
 * Testes estruturais do fluxo EXAMES_HGP (rev-4).
 *
 * Estes testes NÃO invocam Deno/Edge Functions — validam apenas os helpers
 * puros e a coerência do contrato entre camadas (Kanban, status canônico,
 * guard determinístico, resposta pivô para agendar no HGP).
 */
import { describe, it, expect } from "vitest";
import {
  classificarExamePreco,
  replyPrecoExameTabelado,
  detalheCanonicoExame,
  LOCAL_HGP_CANONICO,
  isAceiteAgendarExame,
  REPLY_EXAME_NAO_INFORMADO,
} from "../../../supabase/functions/_shared/examesPrecoGuard.ts";
import { DEFAULT_COLUMNS, normalizeStatusFunil } from "@/hooks/useKanbanColumnsConfig";

describe("Kanban rev-4 — coluna EXAMES_HGP", () => {
  it("existe entre Em conversa e Aguardando confirmação", () => {
    const slugs = DEFAULT_COLUMNS.map((c) => c.status);
    const iEm = slugs.indexOf("em_conversa");
    const iEx = slugs.indexOf("exames_hgp");
    const iAg = slugs.indexOf("aguardando_confirmacao");
    expect(iEm).toBeGreaterThanOrEqual(0);
    expect(iEx).toBe(iEm + 1);
    expect(iAg).toBe(iEx + 1);
  });
  it("normalizeStatusFunil aceita exames_hgp em variações", () => {
    expect(normalizeStatusFunil("exames_hgp")).toBe("exames_hgp");
    expect(normalizeStatusFunil("EXAMES_HGP")).toBe("exames_hgp");
    expect(normalizeStatusFunil("exames-hgp")).toBe("exames_hgp");
  });
});

describe("Preço tabelado — 4 exames a R$ 300,00 no HGP (rev-4)", () => {
  const exames = ["retinografia", "mapeamento de retina", "biometria", "paquimetria"];
  for (const e of exames) {
    it(`classifica "${e}" como preco_tabelado`, () => {
      const r = classificarExamePreco(`qual o valor de ${e}?`);
      expect(r.kind).toBe("preco_tabelado");
    });
    it(`reply de "${e}" cita R$ 300,00 + HGP + oferta de agendamento`, () => {
      const reply = replyPrecoExameTabelado(e);
      expect(reply).toMatch(/R\$ ?300,00/);
      expect(reply).toMatch(/HGP/);
      expect(reply).toMatch(/agendar/i);
    });
  }

  it("variações sem acento/caixa continuam tabeladas", () => {
    expect(classificarExamePreco("VALOR DA RETINOGRAFIA").kind).toBe("preco_tabelado");
    expect(classificarExamePreco("quanto custa mapeamento de retina").kind).toBe("preco_tabelado");
  });

  it("resposta isolada 'retinografia' após pergunta do bot = preço tabelado", () => {
    expect(classificarExamePreco("retinografia").kind).toBe("preco_tabelado");
  });

  it("'qual o valor do exame?' sem nome pede o nome do exame", () => {
    const r = classificarExamePreco("qual o valor do exame?");
    expect(r.kind).toBe("preco_generico_sem_exame");
    expect(REPLY_EXAME_NAO_INFORMADO).toMatch(/Qual exame/i);
  });
});

describe("Aceite '/sim/pode/quero' após oferta de agendar exame", () => {
  it("reconhece continuações positivas", () => {
    for (const t of ["sim", "Pode", "quero", "claro", "beleza", "ok", "vamos", "pode agendar"]) {
      expect(isAceiteAgendarExame(t)).toBe(true);
    }
  });
  it("ignora frases longas ou negativas", () => {
    expect(isAceiteAgendarExame("não obrigado")).toBe(false);
    expect(isAceiteAgendarExame("depois eu vejo")).toBe(false);
    expect(isAceiteAgendarExame("")).toBe(false);
  });
});

describe("Canônicos rev-4", () => {
  it("detalheCanonicoExame em Title Case pt-BR", () => {
    expect(detalheCanonicoExame("retinografia")).toBe("Retinografia");
    expect(detalheCanonicoExame("mapeamento de retina")).toBe("Mapeamento de Retina");
    expect(detalheCanonicoExame("biometria")).toBe("Biometria");
  });
  it("LOCAL_HGP_CANONICO bate com o filtro de listar-datas-disponiveis", () => {
    expect(LOCAL_HGP_CANONICO).toBe("Hospital Geral de Paragominas");
  });
});

describe("Outros exames NÃO tabelados continuam handoff HGP", () => {
  it("OCT / tomografia / campo visual / topografia / microscopia / ultrassom", () => {
    for (const t of [
      "quanto custa OCT",
      "preço tomografia de retina",
      "valor do campo visual",
      "quanto é a topografia",
      "microscopia especular preço",
      "ultrassom ocular quanto custa",
    ]) {
      const r = classificarExamePreco(t);
      expect(r.kind).toBe("handoff_exame_nao_tabelado");
    }
  });
  it("resultado/laudo/preparo/cobertura/agendar/retorno de exame tabelado NÃO é resposta de preço", () => {
    // Não deve classificar como preco_tabelado — deve deixar o detector
    // genérico de assunto de exames (detectarAssuntoExames) capturar.
    expect(classificarExamePreco("resultado da retinografia").kind).not.toBe("preco_tabelado");
    expect(classificarExamePreco("quero agendar retinografia").kind).not.toBe("preco_tabelado");
    expect(classificarExamePreco("convênio cobre retinografia?").kind).not.toBe("preco_tabelado");
  });
  it("'exame de consciência' continua fora do handoff", () => {
    expect(classificarExamePreco("fiz exame de consciência").kind).toBe("none");
  });
});
