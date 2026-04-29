CREATE OR REPLACE FUNCTION public.get_leads_sem_boas_vindas(
  p_cutoff_minutes integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  nome_completo text,
  telefone_whatsapp text,
  tipo_atendimento text,
  local_atendimento text,
  convenio text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.nome_completo,
    a.telefone_whatsapp,
    a.tipo_atendimento,
    a.local_atendimento,
    a.convenio,
    a.created_at
  FROM public.agendamentos a
  WHERE a.status_funil = 'lead'
    AND a.status_crm = 'NOVO LEAD'
    AND a.created_at < (now() - make_interval(mins => GREATEST(0, COALESCE(p_cutoff_minutes, 5))))
    AND NOT EXISTS (
      SELECT 1
      FROM public.mensagens_whatsapp m
      WHERE m.agendamento_id = a.id
        AND m.tipo_mensagem = 'boas_vindas'
        AND m.direcao = 'OUT'
    )
  ORDER BY a.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_leads_sem_boas_vindas(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leads_sem_boas_vindas(integer) TO service_role, authenticated;