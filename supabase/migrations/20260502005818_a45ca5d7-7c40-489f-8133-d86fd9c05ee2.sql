ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS utm_source     text,
  ADD COLUMN IF NOT EXISTS utm_medium     text,
  ADD COLUMN IF NOT EXISTS utm_campaign   text,
  ADD COLUMN IF NOT EXISTS utm_term       text,
  ADD COLUMN IF NOT EXISTS utm_content    text,
  ADD COLUMN IF NOT EXISTS gclid          text,
  ADD COLUMN IF NOT EXISTS fbclid         text,
  ADD COLUMN IF NOT EXISTS gbraid         text,
  ADD COLUMN IF NOT EXISTS wbraid         text,
  ADD COLUMN IF NOT EXISTS fbp            text,
  ADD COLUMN IF NOT EXISTS fbc            text,
  ADD COLUMN IF NOT EXISTS landing_page   text,
  ADD COLUMN IF NOT EXISTS referrer       text;

CREATE INDEX IF NOT EXISTS idx_agendamentos_utm_source ON public.agendamentos (utm_source);
CREATE INDEX IF NOT EXISTS idx_agendamentos_utm_campaign ON public.agendamentos (utm_campaign);