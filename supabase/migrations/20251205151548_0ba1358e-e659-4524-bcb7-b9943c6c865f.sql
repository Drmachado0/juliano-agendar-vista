-- Add clinica_id to disponibilidade_semanal for per-clinic schedules
ALTER TABLE public.disponibilidade_semanal 
ADD COLUMN IF NOT EXISTS clinica_id uuid REFERENCES public.clinicas(id) ON DELETE CASCADE;

-- Add unique constraint for clinica + dia_semana combination
ALTER TABLE public.disponibilidade_semanal 
DROP CONSTRAINT IF EXISTS disponibilidade_semanal_dia_semana_key;

ALTER TABLE public.disponibilidade_semanal 
ADD CONSTRAINT disponibilidade_semanal_clinica_dia_semana_key UNIQUE (clinica_id, dia_semana);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_disponibilidade_semanal_clinica ON public.disponibilidade_semanal(clinica_id);

-- Add clinica_id to disponibilidade_especifica as well
ALTER TABLE public.disponibilidade_especifica 
ADD COLUMN IF NOT EXISTS clinica_id uuid REFERENCES public.clinicas(id) ON DELETE CASCADE;

-- Update unique constraint for especifica
ALTER TABLE public.disponibilidade_especifica 
DROP CONSTRAINT IF EXISTS disponibilidade_especifica_data_key;

ALTER TABLE public.disponibilidade_especifica 
ADD CONSTRAINT disponibilidade_especifica_clinica_data_key UNIQUE (clinica_id, data);

CREATE INDEX IF NOT EXISTS idx_disponibilidade_especifica_clinica ON public.disponibilidade_especifica(clinica_id);