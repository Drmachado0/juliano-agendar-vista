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
      // SELECT * evita 400 (código 42703) caso as colunas
      // google_reviews_total/google_rating ainda não tenham sido criadas em
      // site_config — schema opcional criado pela sync do Google.
      const { data, error } = await supabase
        .from("site_config" as any)
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (error || !data) return null;
      const row = data as Record<string, unknown>;
      return {
        google_reviews_total:
          typeof row.google_reviews_total === "number" ? row.google_reviews_total : null,
        google_rating:
          typeof row.google_rating === "number" ? row.google_rating : null,
      };
    },
    staleTime: 1000 * 60 * 60, // 1h
  });

  return {
    count: data?.google_reviews_total ?? GOOGLE_REVIEWS.count,
    rating: data?.google_rating ?? GOOGLE_REVIEWS.rating,
  };
}
