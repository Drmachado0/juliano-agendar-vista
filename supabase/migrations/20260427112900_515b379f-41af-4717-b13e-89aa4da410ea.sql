-- Adiciona campos ao hermes_drafts para suportar ações sugeridas e origem
ALTER TABLE public.hermes_drafts
  ADD COLUMN IF NOT EXISTS acoes_sugeridas jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tipo_origem text NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_hermes_drafts_status_created
  ON public.hermes_drafts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hermes_drafts_agendamento
  ON public.hermes_drafts (agendamento_id);
