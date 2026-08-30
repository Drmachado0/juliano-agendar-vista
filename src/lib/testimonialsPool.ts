import type { AvaliacaoGoogle } from "@/services/avaliacoesGoogle";
import { MAX_TESTIMONIALS } from "@/lib/constants";

export { MAX_TESTIMONIALS };

export interface TestimonialItem {
  id: string;
  name: string;
  rating: number;
  text: string;
  date: string;
  image?: string;
}

/*
  QUANTOS CARACTERES DE TEXTO ENTRAM NA IDENTIDADE. A raspagem do Google Maps
  corta o texto longo e cola " …" no fim, enquanto a Places API devolve inteiro.
  Comparar o texto todo separaria as duas copias da mesma avaliacao. Sessenta
  caracteres ficam antes de qualquer corte observado e ja distinguem avaliacoes
  diferentes do mesmo autor.

  QUEM MANDA HOJE E O BANCO, e nao este arquivo. A funcao avaliacao_identidade,
  criada em 20260830090000_avaliacoes_google_sem_gemea.sql, tem a mesma regra, e
  um trigger BEFORE INSERT impede que a mesma avaliacao entre duas vezes. O que
  sobrou aqui e rede de seguranca.

  A REDE FICA por um caso que o trigger nao pega: ele so dispara em INSERT, e se
  o paciente editar a avaliacao no Google o texto muda, a identidade muda junto,
  e a linha nova entra sem reconhecer a antiga. Duplicata na tela e pior que
  duas copias da regra.

  Mudou o numero ou a normalizacao aqui, mude na migracao tambem.
*/
const ASSINATURA_TEXTO = 60;

/**
 * Identidade real de uma avaliação, independente da fonte.
 *
 * NAO USA google_review_id quando ha texto, de proposito. A mesma avaliacao
 * chega ao banco por dois caminhos com chaves diferentes: o cron da Places API
 * grava "Autor_timestamp" e o backfill do Maps grava "maps_<id do Google>". Nem
 * o timestamp bate entre os dois. O que bate e o par autor mais texto.
 *
 * Sem texto nao ha o que assinar, entao cai para a chave da linha. Avaliacao
 * sem texto nao aparece no mural de qualquer jeito.
 */
function identidade(item: AvaliacaoGoogle): string {
  const corpo = (item.text || "").trim().replace(/\s+/g, " ").toLowerCase();
  if (!corpo) return item.google_review_id || item.id;
  const autor = (item.author_name || "").trim().toLowerCase();
  return `${autor}::${corpo.slice(0, ASSINATURA_TEXTO)}`;
}

/** Deduplica pela identidade de autor mais texto, com fallback à chave da linha. */
export function dedupeAvaliacoes(list: AvaliacaoGoogle[]): AvaliacaoGoogle[] {
  const seen = new Set<string>();
  const out: AvaliacaoGoogle[] = [];
  for (const item of list) {
    const key = identidade(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Constrói o pool exibido no mural.
 *
 * - deduplica por autor mais texto, com fallback à chave da linha
 * - ordena por data mais recente e depois por rating
 * - descarta avaliação sem texto, porque nota sem comentário não é prova social
 * - limita a MAX_TESTIMONIALS, hoje 70 (o banco tem ~67 com texto pos-backfill)
 */
export function buildTestimonialPool(list: AvaliacaoGoogle[]): TestimonialItem[] {
  // dedupeAvaliacoes ja devolve um array novo, entao ordenar no lugar nao mexe
  // no array de quem chamou.
  const sorted = dedupeAvaliacoes(list).sort((a, b) => {
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
