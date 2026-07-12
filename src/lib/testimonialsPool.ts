import type { AvaliacaoGoogle } from "@/services/avaliacoesGoogle";

export const MAX_TESTIMONIALS = 20;

export interface TestimonialItem {
  id: string;
  name: string;
  rating: number;
  text: string;
  date: string;
  image?: string;
}

/** Deduplica por google_review_id (canônico); fallback ao id da linha. */
export function dedupeAvaliacoes(list: AvaliacaoGoogle[]): AvaliacaoGoogle[] {
  const seen = new Set<string>();
  const out: AvaliacaoGoogle[] = [];
  for (const item of list) {
    const key = item.google_review_id || item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Constrói o pool exibido no carrossel:
 * - dedup por google_review_id/id
 * - ordena por data mais recente e depois rating
 * - descarta avaliações sem texto real (regra do briefing)
 * - limita a MAX_TESTIMONIALS (20)
 */
export function buildTestimonialPool(list: AvaliacaoGoogle[]): TestimonialItem[] {
  const deduped = dedupeAvaliacoes(list);
  const sorted = [...deduped].sort((a, b) => {
    const tb = b.time_epoch || 0;
    const ta = a.time_epoch || 0;
    if (tb !== ta) return tb - ta;
    return (b.rating || 0) - (a.rating || 0);
  });
  const out: TestimonialItem[] = [];
  for (const av of sorted) {
    const text = (av.text || "").trim();
    if (!text) continue;
    out.push({
      id: av.id,
      name: av.author_name,
      rating: Math.max(1, Math.min(5, Math.round(av.rating || 5))),
      text,
      date: av.relative_time_description || "Avaliação recente",
      image: av.author_photo_url || undefined,
    });
    if (out.length >= MAX_TESTIMONIALS) break;
  }
  return out;
}
