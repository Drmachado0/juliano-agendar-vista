
-- 1. Public SELECT policy for bloqueios_agenda (non-sensitive scheduling data)
CREATE POLICY "Public can view bloqueios"
ON public.bloqueios_agenda FOR SELECT
TO anon, authenticated
USING (true);

-- 2. Security definer function to expose only occupied time slots (no patient data)
CREATE OR REPLACE FUNCTION public.horarios_ocupados(
  p_data_inicio date,
  p_data_fim date,
  p_clinica_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(data_agendamento date, hora_agendamento time without time zone, clinica_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.data_agendamento::date, a.hora_agendamento, a.clinica_id
  FROM public.agendamentos a
  WHERE a.data_agendamento IS NOT NULL
    AND a.hora_agendamento IS NOT NULL
    AND a.data_agendamento >= p_data_inicio
    AND a.data_agendamento <= p_data_fim
    AND (p_clinica_ids IS NULL OR a.clinica_id = ANY(p_clinica_ids))
$$;
