import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GOOGLE_REVIEWS } from "@/lib/constants";

export interface GoogleReviewsData {
  /** Total REAL de avaliações (do Google, via site_config) com fallback à constante. */
  count: number;
  /** Nota média (0-5) com fallback à constante. */
  rating: number;
}

interface SiteConfigReviews {
  google_reviews_total: number | null;
  google_rating: number | null;
}

/**
 * Lê o total real de avaliações e a nota média gravados em site_config pela
 * sincronização do Google. Enquanto não há valor sincronizado (ou a migration
 * das colunas ainda não foi aplicada), cai no fallback de @/lib/constants —
 * mantendo o site sempre exibindo algo válido e isolando essa consulta do
 * fetch do número de WhatsApp.
 */
export function useGoogleReviews(): GoogleReviewsData {
  const { data } = useQuery({
    queryKey: ["google-reviews-meta"],
    queryFn: async (): Promise<SiteConfigReviews | null> => {
      const { data, error } = await supabase
        .from("site_config" as any)
        .select("google_reviews_total, google_rating")
        .eq("id", true)
        .maybeSingle();
      if (error) return null; // colunas ausentes/sem sync → usa fallback
      return (data as unknown as SiteConfigReviews) ?? null;
    },
    staleTime: 1000 * 60 * 60, // 1h
  });

  return {
    count: data?.google_reviews_total ?? GOOGLE_REVIEWS.count,
    rating: data?.google_rating ?? GOOGLE_REVIEWS.rating,
  };
}
