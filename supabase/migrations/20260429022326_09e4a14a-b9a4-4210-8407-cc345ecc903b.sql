CREATE OR REPLACE FUNCTION public.relatorio_diario(
  p_data_inicio date DEFAULT ((CURRENT_DATE - '6 days'::interval))::date,
  p_data_fim date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_msg_in int; v_msg_out int;
  v_msg_por_tipo jsonb;
  v_leads_novos int; v_conversoes int;
  v_funil jsonb;
  v_inicio timestamptz := p_data_inicio::timestamptz;
  v_fim timestamptz := (p_data_fim + 1)::timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE direcao='IN'),
    COUNT(*) FILTER (WHERE direcao='OUT')
  INTO v_msg_in, v_msg_out
  FROM public.mensagens_whatsapp
  WHERE created_at >= v_inicio AND created_at < v_fim;

  SELECT COALESCE(jsonb_object_agg(tipo_mensagem, qtd), '{}'::jsonb) INTO v_msg_por_tipo
  FROM (
    SELECT COALESCE(tipo_mensagem,'(none)') AS tipo_mensagem, COUNT(*) AS qtd
    FROM public.mensagens_whatsapp
    WHERE created_at >= v_inicio AND created_at < v_fim
    GROUP BY tipo_mensagem
  ) t;

  SELECT COUNT(*) INTO v_leads_novos
  FROM public.agendamentos
  WHERE created_at >= v_inicio AND created_at < v_fim;

  SELECT COUNT(*) INTO v_conversoes
  FROM public.crm_audit_log
  WHERE created_at >= v_inicio AND created_at < v_fim
    AND status_novo IN ('CLINICOR','HGP','agendado');

  SELECT COALESCE(jsonb_object_agg(status, qtd), '{}'::jsonb) INTO v_funil
  FROM (
    SELECT COALESCE(status_funil,'(none)') AS status, COUNT(*) AS qtd
    FROM public.agendamentos
    GROUP BY status_funil
  ) t;

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
    'gerado_em', now(),
    'whatsapp', jsonb_build_object(
      'mensagens_in', v_msg_in,
      'mensagens_out', v_msg_out,
      'total', v_msg_in + v_msg_out,
      'por_tipo', v_msg_por_tipo
    ),
    'crm', jsonb_build_object(
      'leads_novos', v_leads_novos,
      'conversoes', v_conversoes,
      'funil_atual', v_funil
    )
  );
END;
$function$;