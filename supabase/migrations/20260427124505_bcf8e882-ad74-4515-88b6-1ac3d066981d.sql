-- RPC para gerar relatório diário consolidado
CREATE OR REPLACE FUNCTION public.relatorio_diario(p_data_inicio date DEFAULT (CURRENT_DATE - interval '6 days')::date, p_data_fim date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_msg_in int; v_msg_out int;
  v_msg_por_tipo jsonb;
  v_leads_novos int; v_conversoes int;
  v_funil jsonb;
  v_bot_total int; v_bot_escalou int;
  v_intencoes jsonb;
  v_drafts_gerados int; v_drafts_aceitos int; v_drafts_descartados int; v_drafts_editados int;
  v_inicio timestamptz := p_data_inicio::timestamptz;
  v_fim timestamptz := (p_data_fim + 1)::timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- WhatsApp volume
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

  -- CRM
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

  -- Bot vs humano
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE acao IN ('escalar_humano','escalar','handover'))
  INTO v_bot_total, v_bot_escalou
  FROM public.bot_assistente_log
  WHERE created_at >= v_inicio AND created_at < v_fim;

  SELECT COALESCE(jsonb_object_agg(intencao, qtd), '{}'::jsonb) INTO v_intencoes
  FROM (
    SELECT COALESCE(intencao,'(none)') AS intencao, COUNT(*) AS qtd
    FROM public.conversation_intents
    WHERE created_at >= v_inicio AND created_at < v_fim
    GROUP BY intencao
    ORDER BY COUNT(*) DESC
    LIMIT 10
  ) t;

  -- Hermes
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('accepted','sent')),
    COUNT(*) FILTER (WHERE status = 'discarded'),
    COUNT(*) FILTER (WHERE status = 'edited')
  INTO v_drafts_gerados, v_drafts_aceitos, v_drafts_descartados, v_drafts_editados
  FROM public.hermes_drafts
  WHERE created_at >= v_inicio AND created_at < v_fim;

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
    ),
    'bot', jsonb_build_object(
      'acoes_total', v_bot_total,
      'escalacoes', v_bot_escalou,
      'top_intencoes', v_intencoes
    ),
    'hermes', jsonb_build_object(
      'drafts_gerados', v_drafts_gerados,
      'drafts_aceitos', v_drafts_aceitos,
      'drafts_editados', v_drafts_editados,
      'drafts_descartados', v_drafts_descartados,
      'taxa_aceitacao', CASE WHEN v_drafts_gerados>0
        THEN round((v_drafts_aceitos + v_drafts_editados)::numeric / v_drafts_gerados * 100, 1)
        ELSE 0 END
    )
  );
END;
$$;

-- Série diária para gráficos
CREATE OR REPLACE FUNCTION public.relatorio_diario_serie(p_data_inicio date DEFAULT (CURRENT_DATE - interval '13 days')::date, p_data_fim date DEFAULT CURRENT_DATE)
RETURNS TABLE(dia date, msg_in bigint, msg_out bigint, leads_novos bigint, drafts_gerados bigint)
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
    COALESCE((SELECT COUNT(*) FROM public.agendamentos a WHERE a.created_at::date = dias.d),0),
    COALESCE((SELECT COUNT(*) FROM public.hermes_drafts h WHERE h.created_at::date = dias.d),0)
  FROM dias
  ORDER BY dias.d ASC;
END;
$$;