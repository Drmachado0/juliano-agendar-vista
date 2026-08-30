import { describe, it, expect } from "vitest";
import type { AvaliacaoGoogle } from "@/services/avaliacoesGoogle";
import { buildTestimonialPool, dedupeAvaliacoes, MAX_TESTIMONIALS } from "../testimonialsPool";

/*
  SPREAD, e nao uma escada de `??`. Com `over.text ?? padrao` nao da para pedir
  texto vazio, que e justamente o caso mais importante deste arquivo, entao o
  spread e o que deixa `text: ""` e `text: null` chegarem inteiros ao codigo.
*/
const PADRAO: AvaliacaoGoogle = {
  id: "",
  google_review_id: "",
  author_name: "Paciente Teste",
  author_photo_url: null,
  rating: 5,
  text: "Ótimo atendimento e explicação clara.",
  relative_time_description: "há 1 semana",
  time_epoch: 1_700_000_000,
  language: "pt-BR",
  ativo: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const mk = (over: Partial<AvaliacaoGoogle>): AvaliacaoGoogle => ({
  ...PADRAO,
  id: over.google_review_id ?? crypto.randomUUID(),
  google_review_id: `gr_${Math.random()}`,
  ...over,
});

describe("testimonialsPool", () => {
  it("limita o pool a MAX_TESTIMONIALS", () => {
    // O texto precisa variar: a identidade e autor mais texto, entao 80 copias
    // do mesmo depoimento colapsariam em uma so, e com razao.
    const items = Array.from({ length: MAX_TESTIMONIALS + 10 }, (_, i) =>
      mk({ google_review_id: `gr_${i}`, text: `Avaliação número ${i}.`, time_epoch: 1_000_000 + i })
    );
    const pool = buildTestimonialPool(items);
    expect(pool).toHaveLength(MAX_TESTIMONIALS);
  });

  /*
    O CASO REAL QUE ESTES TESTES GUARDAM. A mesma avaliacao chega ao banco por
    dois caminhos com chaves que nunca batem: o cron da Places API grava
    "Autor_timestamp" e o backfill do Google Maps grava "maps_<id do Google>".
    Nem o time_epoch coincide. Sem dedupe por autor mais texto, o mural mostrava
    as 17 avaliacoes antigas duas vezes.
  */
  it("junta a mesma avaliação vinda das duas fontes, apesar das chaves diferentes", () => {
    const texto = "Um excelente profissional, atencioso e didático.";
    const items = [
      mk({ google_review_id: "Eciane_Barbosa_1785421096", author_name: "Eciane Barbosa", text: texto }),
      mk({ google_review_id: "maps_Ci9DQUlRQUNvZ", author_name: "Eciane Barbosa", text: texto }),
    ];
    expect(dedupeAvaliacoes(items)).toHaveLength(1);
  });

  it("tolera o corte de texto da raspagem, que cola reticências no fim", () => {
    const inteiro =
      "Um ótimo atendimento, não tenho do que reclamar, vim através da indicação do meu esposo.";
    const items = [
      mk({ google_review_id: "Jessyca_1", author_name: "Jessyca", text: inteiro }),
      mk({ google_review_id: "maps_x", author_name: "Jessyca", text: `${inteiro.slice(0, 70)} …` }),
    ];
    expect(dedupeAvaliacoes(items)).toHaveLength(1);
  });

  it("mantém avaliações diferentes do mesmo autor", () => {
    const items = [
      mk({ google_review_id: "a", author_name: "Ana", text: "Consulta ótima, voltarei." }),
      mk({ google_review_id: "b", author_name: "Ana", text: "Cirurgia correu muito bem." }),
    ];
    expect(dedupeAvaliacoes(items)).toHaveLength(2);
  });

  /*
    O Google permite uma avaliação por pessoa por local, então sem texto o nome
    do autor já identifica a avaliação. Antes disto a linha caía na chave da
    fonte, e como cron e backfill usam chaves diferentes, a mesma nota entrava
    duas vezes. Aconteceu de verdade em 30/08/2026.
  */
  it("sem texto, identifica pelo autor", () => {
    const items = [
      mk({ google_review_id: "cron_Erik_123", author_name: "Erik Gomes", text: null }),
      mk({ google_review_id: "maps_abc", author_name: "Erik Gomes", text: null }),
      mk({ google_review_id: "maps_def", author_name: "Outra Pessoa", text: null }),
    ];
    const deduped = dedupeAvaliacoes(items);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((x) => x.author_name)).toEqual(["Erik Gomes", "Outra Pessoa"]);
  });

  /*
    Sem texto o autor é a chave inteira, e é justamente aí que as duas fontes
    divergem: a raspagem do Maps devolve nome com espaço duplo, a Places API
    devolve com um. Sem colapsar, a correção acima não valeria de nada.
  */
  it("normaliza espaço interno do autor, senão a gêmea sem texto escapa", () => {
    const items = [
      mk({ google_review_id: "maps_x", author_name: "Jessyca  Aquinno", text: null }),
      mk({ google_review_id: "cron_y", author_name: " Jessyca Aquinno ", text: null }),
    ];
    expect(dedupeAvaliacoes(items)).toHaveLength(1);
  });

  it("sem autor e sem texto, cai para o google_review_id", () => {
    const items = [
      mk({ google_review_id: "a", author_name: "", text: null }),
      mk({ google_review_id: "b", author_name: "", text: null }),
    ];
    expect(dedupeAvaliacoes(items)).toHaveLength(2);
  });

  it("descarta avaliações sem texto, porque nota sozinha não é prova social", () => {
    const items = [
      mk({ google_review_id: "g1", text: "" }),
      mk({ google_review_id: "g2", text: null }),
      mk({ google_review_id: "g3", text: "Consulta excelente." }),
    ];
    const pool = buildTestimonialPool(items);
    expect(pool).toHaveLength(1);
    expect(pool[0].text).toBe("Consulta excelente.");
  });

  it("ordena por data desc, depois rating desc", () => {
    const items = [
      mk({ google_review_id: "old_hi", time_epoch: 100, rating: 5, author_name: "Old" }),
      mk({ google_review_id: "new_lo", time_epoch: 200, rating: 4, author_name: "New" }),
      mk({ google_review_id: "new_hi", time_epoch: 200, rating: 5, author_name: "NewHi" }),
    ];
    const pool = buildTestimonialPool(items);
    expect(pool.map((x) => x.name)).toEqual(["NewHi", "New", "Old"]);
  });

  it("não altera o array de quem chamou", () => {
    const items = [
      mk({ google_review_id: "a", time_epoch: 100 }),
      mk({ google_review_id: "b", time_epoch: 200 }),
    ];
    const ordemOriginal = items.map((x) => x.google_review_id);
    buildTestimonialPool(items);
    expect(items.map((x) => x.google_review_id)).toEqual(ordemOriginal);
  });
});
