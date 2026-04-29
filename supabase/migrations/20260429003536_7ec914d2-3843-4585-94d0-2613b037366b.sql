-- 1) Drop tabelas Hermes
DROP TABLE IF EXISTS public.hermes_drafts CASCADE;
DROP TABLE IF EXISTS public.hermes_conversation_state CASCADE;

-- 2) Drop função RPC dos drafts
DROP FUNCTION IF EXISTS public.marcar_hermes_draft_status(uuid, text, text, uuid);

-- 3) relatorio_diario sem bloco Hermes
CREATE OR REPLACE FUNCTION public.relatorio_diario(p_data_inicio date DEFAULT ((CURRENT_DATE - '6 days'::interval))::date, p_data_fim date DEFAULT CURRENT_DATE)
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
  v_bot_total int; v_bot_escalou int;
  v_intencoes jsonb;
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
    )
  );
END;
$function$;

-- 4) preview_dados_paciente sem hermes_drafts
CREATE OR REPLACE FUNCTION public.preview_dados_paciente(p_telefone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_norm text; v_last8 text;
  v_ag int; v_msg int; v_intents int; v_audit int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  v_norm := public.normalizar_telefone(p_telefone);
  IF v_norm IS NULL OR length(v_norm) < 8 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;
  v_last8 := right(v_norm, 8);

  SELECT COUNT(*) INTO v_ag FROM public.agendamentos WHERE public.normalizar_telefone(telefone_whatsapp) ILIKE '%' || v_last8;
  SELECT COUNT(*) INTO v_msg FROM public.mensagens_whatsapp WHERE public.normalizar_telefone(telefone) ILIKE '%' || v_last8;
  SELECT COUNT(*) INTO v_intents FROM public.conversation_intents WHERE public.normalizar_telefone(telefone) ILIKE '%' || v_last8;
  SELECT COUNT(*) INTO v_audit FROM public.crm_audit_log WHERE agendamento_id IN (
    SELECT id FROM public.agendamentos WHERE public.normalizar_telefone(telefone_whatsapp) ILIKE '%' || v_last8
  );

  RETURN jsonb_build_object(
    'telefone_mascarado', public.mask_telefone(p_telefone),
    'agendamentos', v_ag,
    'mensagens', v_msg,
    'intents', v_intents,
    'audit_logs', v_audit
  );
END;
$function$;

-- 5) exportar_dados_paciente sem hermes_drafts
CREATE OR REPLACE FUNCTION public.exportar_dados_paciente(p_telefone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_norm text;
  v_last8 text;
  v_agendamentos jsonb;
  v_mensagens jsonb;
  v_logs jsonb;
  v_intents jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  PERFORM public.lgpd_check_rate_limit('exportar', 20);

  v_norm := public.normalizar_telefone(p_telefone);
  IF v_norm IS NULL OR length(v_norm) < 8 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;
  v_last8 := right(v_norm, 8);

  SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb) INTO v_agendamentos
  FROM public.agendamentos a
  WHERE public.normalizar_telefone(a.telefone_whatsapp) ILIKE '%' || v_last8;

  SELECT COALESCE(jsonb_agg(to_jsonb(m)), '[]'::jsonb) INTO v_mensagens
  FROM public.mensagens_whatsapp m
  WHERE public.normalizar_telefone(m.telefone) ILIKE '%' || v_last8;

  SELECT COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb) INTO v_logs
  FROM public.crm_audit_log l
  WHERE l.agendamento_id IN (
    SELECT id FROM public.agendamentos WHERE public.normalizar_telefone(telefone_whatsapp) ILIKE '%' || v_last8
  );

  SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb) INTO v_intents
  FROM public.conversation_intents i
  WHERE public.normalizar_telefone(i.telefone) ILIKE '%' || v_last8;

  PERFORM public.lgpd_log('exportar_dados', p_telefone, jsonb_build_object(
    'agendamentos', jsonb_array_length(v_agendamentos),
    'mensagens', jsonb_array_length(v_mensagens),
    'audit_logs', jsonb_array_length(v_logs),
    'intents', jsonb_array_length(v_intents)
  ));

  RETURN jsonb_build_object(
    'telefone', p_telefone,
    'gerado_em', now(),
    'agendamentos', v_agendamentos,
    'mensagens_whatsapp', v_mensagens,
    'crm_audit_log', v_logs,
    'conversation_intents', v_intents
  );
END;
$function$;

-- 6) apagar_dados_paciente sem hermes_drafts
CREATE OR REPLACE FUNCTION public.apagar_dados_paciente(p_telefone text, p_confirmar boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_norm text;
  v_last8 text;
  v_ag_ids uuid[];
  v_count_ag int;
  v_count_msg int;
  v_count_intents int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  IF NOT p_confirmar THEN
    RAISE EXCEPTION 'Confirmação obrigatória (p_confirmar=true)';
  END IF;
  PERFORM public.lgpd_check_rate_limit('apagar', 20);

  v_norm := public.normalizar_telefone(p_telefone);
  IF v_norm IS NULL OR length(v_norm) < 8 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;
  v_last8 := right(v_norm, 8);

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_ag_ids
  FROM public.agendamentos
  WHERE public.normalizar_telefone(telefone_whatsapp) ILIKE '%' || v_last8;

  v_count_ag := array_length(v_ag_ids, 1);
  IF v_count_ag IS NULL THEN v_count_ag := 0; END IF;

  UPDATE public.agendamentos
  SET nome_completo = '[ANONIMIZADO]',
      telefone_whatsapp = '[ANONIMIZADO]',
      email = NULL,
      data_nascimento = NULL,
      observacoes_internas = NULL,
      observacoes_internas_encrypted = NULL,
      updated_at = now()
  WHERE id = ANY(v_ag_ids);

  UPDATE public.mensagens_whatsapp
  SET telefone = '[ANONIMIZADO]',
      conteudo = '[ANONIMIZADO]',
      payload = NULL
  WHERE public.normalizar_telefone(telefone) ILIKE '%' || v_last8;
  GET DIAGNOSTICS v_count_msg = ROW_COUNT;

  UPDATE public.conversation_intents
  SET telefone = '[ANONIMIZADO]',
      resumo = NULL,
      raw_output = NULL
  WHERE public.normalizar_telefone(telefone) ILIKE '%' || v_last8;
  GET DIAGNOSTICS v_count_intents = ROW_COUNT;

  PERFORM public.lgpd_log('apagar_dados', p_telefone, jsonb_build_object(
    'agendamentos', v_count_ag,
    'mensagens', v_count_msg,
    'intents', v_count_intents
  ));

  RETURN jsonb_build_object(
    'sucesso', true,
    'telefone_mascarado', public.mask_telefone(p_telefone),
    'agendamentos_anonimizados', v_count_ag,
    'mensagens_anonimizadas', v_count_msg,
    'intents_anonimizados', v_count_intents
  );
END;
$function$;