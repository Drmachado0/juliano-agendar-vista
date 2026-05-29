
-- 1) Campos novos no agendamentos
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS motivo_status text,
  ADD COLUMN IF NOT EXISTS ultimo_followup_em timestamptz;

-- 2) Normalizar valores legados de status_funil para o novo vocabulário
-- 'lead' (legado) -> 'novo'
UPDATE public.agendamentos SET status_funil = 'novo'
WHERE status_funil = 'lead';

-- 'confirmado' (legado) -> 'agendado' (a coluna "Agendado" cobre confirmados também)
UPDATE public.agendamentos SET status_funil = 'agendado'
WHERE status_funil = 'confirmado';

-- 'finalizado' / 'atendido' (legado) -> 'compareceu'
UPDATE public.agendamentos SET status_funil = 'compareceu'
WHERE status_funil IN ('finalizado','atendido');

-- 3) Índice para filtros do kanban
CREATE INDEX IF NOT EXISTS idx_agendamentos_status_funil_created
  ON public.agendamentos(status_funil, created_at DESC);
