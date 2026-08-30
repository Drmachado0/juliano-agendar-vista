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
  it("limita o pool a MAX_TESTIMONIALS (20)", () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      mk({ google_review_id: `gr_${i}`, time_epoch: 1_000_000 + i })
    );
    const pool = buildTestimonialPool(items);
    expect(MAX_TESTIMONIALS).toBe(20);
    expect(pool).toHaveLength(20);
  });

  it("deduplica por google_review_id", () => {
    const items = [
      mk({ google_review_id: "same", author_name: "A" }),
      mk({ google_review_id: "same", author_name: "B" }),
      mk({ google_review_id: "other", author_name: "C" }),
    ];
    const deduped = dedupeAvaliacoes(items);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((x) => x.author_name)).toEqual(["A", "C"]);
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
