ALTER TABLE public.agendamentos
ADD COLUMN IF NOT EXISTS estado_atendimento TEXT NOT NULL DEFAULT 'novo';

CREATE INDEX IF NOT EXISTS idx_agendamentos_estado_atendimento
ON public.agendamentos (estado_atendimento);