CREATE UNIQUE INDEX IF NOT EXISTS uniq_agendamento_slot_ativo
ON public.agendamentos (clinica_id, data_agendamento, hora_agendamento)
WHERE status_crm <> 'cancelado'
  AND data_agendamento IS NOT NULL
  AND hora_agendamento IS NOT NULL
  AND clinica_id IS NOT NULL;