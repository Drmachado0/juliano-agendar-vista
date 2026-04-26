ALTER TABLE public.google_calendar_tokens
  ADD COLUMN IF NOT EXISTS sync_token text,
  ADD COLUMN IF NOT EXISTS last_pull_at timestamptz,
  ADD COLUMN IF NOT EXISTS pull_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS google_calendar_etag text,
  ADD COLUMN IF NOT EXISTS google_calendar_synced_at timestamptz;

ALTER TABLE public.google_calendar_settings
  ADD COLUMN IF NOT EXISTS default_import_clinica_id uuid;

CREATE INDEX IF NOT EXISTS idx_agendamentos_google_event_id
  ON public.agendamentos(google_calendar_event_id)
  WHERE google_calendar_event_id IS NOT NULL;