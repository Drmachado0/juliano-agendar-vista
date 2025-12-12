-- Criar enum para status do funil
CREATE TYPE status_funil_enum AS ENUM ('lead', 'agendado', 'confirmado', 'cancelado');

-- Adicionar coluna status_funil à tabela agendamentos
ALTER TABLE public.agendamentos 
ADD COLUMN status_funil text DEFAULT 'agendado';

-- Tornar data_agendamento e hora_agendamento nullable
ALTER TABLE public.agendamentos 
ALTER COLUMN data_agendamento DROP NOT NULL;

ALTER TABLE public.agendamentos 
ALTER COLUMN hora_agendamento DROP NOT NULL;

-- Atualizar registros existentes para ter status_funil = 'agendado'
UPDATE public.agendamentos 
SET status_funil = 'agendado' 
WHERE status_funil IS NULL OR status_funil = '';

-- Criar índice para performance nas queries do CRM
CREATE INDEX idx_agendamentos_status_funil ON public.agendamentos(status_funil);
CREATE INDEX idx_agendamentos_status_crm_funil ON public.agendamentos(status_crm, status_funil);