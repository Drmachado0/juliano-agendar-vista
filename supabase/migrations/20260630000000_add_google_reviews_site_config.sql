-- Armazena o total REAL de avaliações e a nota média do Google na config do site.
-- Preenchidos pela edge function sincronizar-avaliacoes-google a partir do campo
-- user_ratings_total da Google Places API. Alimentam o selo "+N avaliações" e o
-- dado estruturado (aggregateRating) do site — sempre verídicos, sem valor manual.
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS google_reviews_total integer,
  ADD COLUMN IF NOT EXISTS google_rating numeric(2,1);
