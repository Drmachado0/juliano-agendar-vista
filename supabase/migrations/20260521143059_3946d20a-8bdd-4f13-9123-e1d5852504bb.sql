UPDATE public.agendamentos
SET status_crm = 'BLOQUEIO/AGENDA',
    status_funil = 'bloqueio',
    updated_at = now()
WHERE origem = 'google_calendar'
  AND telefone_whatsapp = '0000000000'
  AND status_crm = 'NOVO LEAD';