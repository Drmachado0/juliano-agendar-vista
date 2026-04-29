DROP FUNCTION IF EXISTS public.relatorio_diario_serie(date, date);

CREATE OR REPLACE FUNCTION public.relatorio_diario_serie(
  p_data_inicio date DEFAULT (CURRENT_DATE - interval '13 days')::date,
  p_data_fim date DEFAULT CURRENT_DATE
)
RETURNS TABLE(dia date, msg_in bigint, msg_out bigint, leads_novos bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  WITH dias AS (
    SELECT generate_series(p_data_inicio, p_data_fim, interval '1 day')::date AS d
  )
  SELECT
    dias.d,
    COALESCE((SELECT COUNT(*) FROM public.mensagens_whatsapp m WHERE m.created_at::date = dias.d AND m.direcao='IN'),0),
    COALESCE((SELECT COUNT(*) FROM public.mensagens_whatsapp m WHERE m.created_at::date = dias.d AND m.direcao='OUT'),0),
    COALESCE((SELECT COUNT(*) FROM public.agendamentos a WHERE a.created_at::date = dias.d),0)
  FROM dias
  ORDER BY dias.d ASC;
END;
$$;