CREATE UNIQUE INDEX IF NOT EXISTS agendamentos_event_id_unico
  ON public.agendamentos (event_id)
  WHERE event_id IS NOT NULL;