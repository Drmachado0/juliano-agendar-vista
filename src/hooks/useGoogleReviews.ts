import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GOOGLE_REVIEWS } from "@/lib/constants";

export interface GoogleReviewsData {
  /** Total REAL de avaliações (do Google, via site_config) com fallback à constante. */
  count: number;
  /** Nota média (0-5) com fallback à constante. */
  rating: number;
  /** true quando os valores vieram da sincronização real do Google. */
  hasRealAggregate: boolean;
}

interface SiteConfigReviews {
  google_reviews_total: number | null;
  google_rating: number | null;
}

/**
 * Lê o total real de avaliações e a nota média gravados em site_config pela
 * sincronização do Google (edge function `sincronizar-avaliacoes-google`,
 * cron diário `sync-google-reviews-daily`).
 */
export function useGoogleReviews(): GoogleReviewsData {
  const { data } = useQuery({
    queryKey: ["google-reviews-meta"],
    queryFn: async (): Promise<SiteConfigReviews | null> => {
      const { data, error } = await supabase
        .from("site_config" as any)
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (error || !data) return null;
      const row = data as unknown as Record<string, unknown>;
      return {
        google_reviews_total:
          typeof row.google_reviews_total === "number" ? row.google_reviews_total : null,
        google_rating:
          typeof row.google_rating === "number" ? row.google_rating : null,
      };
    },
    staleTime: 1000 * 60 * 30,
    refetchInterval: 1000 * 60 * 30,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });

  const realCount = data?.google_reviews_total;
  const realRating = data?.google_rating;

  return {
    count: realCount ?? GOOGLE_REVIEWS.count,
    rating: realRating ?? GOOGLE_REVIEWS.rating,
    hasRealAggregate: typeof realCount === "number" && typeof realRating === "number",
  };
}

