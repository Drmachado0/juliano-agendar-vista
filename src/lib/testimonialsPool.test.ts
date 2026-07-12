import { describe, it, expect } from "vitest";
import type { AvaliacaoGoogle } from "@/services/avaliacoesGoogle";
import { buildTestimonialPool, dedupeAvaliacoes, MAX_TESTIMONIALS } from "./testimonialsPool";

const mk = (over: Partial<AvaliacaoGoogle>): AvaliacaoGoogle => ({
  id: over.id ?? crypto.randomUUID(),
  google_review_id: over.google_review_id ?? `gr_${Math.random()}`,
  author_name: over.author_name ?? "Paciente Teste",
  author_photo_url: over.author_photo_url ?? null,
  rating: over.rating ?? 5,
  text: over.text ?? "Ótimo atendimento e explicação clara.",
  relative_time_description: over.relative_time_description ?? "há 1 semana",
  time_epoch: over.time_epoch ?? Math.floor(Date.now() / 1000),
  language: over.language ?? "pt-BR",
  ativo: over.ativo ?? true,
  created_at: over.created_at ?? new Date().toISOString(),
  updated_at: over.updated_at ?? new Date().toISOString(),
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

  it("descarta avaliações sem texto (regra do briefing)", () => {
    const items = [
      mk({ google_review_id: "g1", text: "" }),
      mk({ google_review_id: "g2", text: null as unknown as string }),
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

  it("não injeta texto fake quando o texto original está vazio", () => {
    const pool = buildTestimonialPool([mk({ text: "" })]);
    expect(pool).toHaveLength(0);
    // Garantia adicional: nenhum item traz o antigo fallback inventado.
    expect(pool.some((t) => t.text.includes("Excelente atendimento!"))).toBe(false);
  });
});
