ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS event_id text;
CREATE INDEX IF NOT EXISTS idx_agendamentos_event_id ON public.agendamentos(event_id) WHERE event_id IS NOT NULL;