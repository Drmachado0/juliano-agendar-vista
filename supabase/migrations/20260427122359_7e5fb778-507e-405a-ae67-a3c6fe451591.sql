-- ============= LGPD utilities =============

-- Mascaramento de PII
CREATE OR REPLACE FUNCTION public.mask_telefone(p_tel text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_tel IS NULL OR length(regexp_replace(p_tel,'\D','','g')) < 4 THEN '***'
    ELSE '***' || right(regexp_replace(p_tel,'\D','','g'), 4)
  END
$$;

CREATE OR REPLACE FUNCTION public.mask_email(p_email text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_email IS NULL OR position('@' in p_email) = 0 THEN NULL
    ELSE left(split_part(p_email,'@',1),1) || '***@' || split_part(p_email,'@',2)
  END
$$;

CREATE OR REPLACE FUNCTION public.mask_nome(p_nome text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_nome IS NULL OR length(trim(p_nome)) = 0 THEN NULL
    ELSE split_part(trim(p_nome),' ',1) || ' ***'
  END
$$;

-- Rate limit table (in-memory style)
CREATE TABLE IF NOT EXISTS public.lgpd_rate_limit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  acao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lgpd_rate_user_time ON public.lgpd_rate_limit(user_id, acao, created_at DESC);
ALTER TABLE public.lgpd_rate_limit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage lgpd rate limit" ON public.lgpd_rate_limit
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE OR REPLACE FUNCTION public.lgpd_check_rate_limit(p_acao text, p_limite int DEFAULT 20)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.lgpd_rate_limit
  WHERE user_id = auth.uid()
    AND acao = p_acao
    AND created_at >= now() - interval '1 hour';
  IF v_count >= p_limite THEN
    RAISE EXCEPTION 'Rate limit excedido para %: % chamadas/h', p_acao, p_limite;
  END IF;
  INSERT INTO public.lgpd_rate_limit(user_id, acao) VALUES (auth.uid(), p_acao);
END;
$$;

-- Logger LGPD (sem checar role admin no insert)
CREATE OR REPLACE FUNCTION public.lgpd_log(p_acao text, p_telefone text, p_detalhes jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.system_logs (level, category, source, message, details, user_id, user_email)
  VALUES (
    'warn','lgpd','lgpd_panel',
    p_acao || ' · ' || public.mask_telefone(p_telefone),
    COALESCE(p_detalhes,'{}'::jsonb) || jsonb_build_object('telefone_mascarado', public.mask_telefone(p_telefone)),
    auth.uid(), v_email
  );
END;
$$;

-- Exportar dados (portabilidade)
CREATE OR REPLACE FUNCTION public.exportar_dados_paciente(p_telefone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_norm text;
  v_last8 text;
  v_agendamentos jsonb;
  v_mensagens jsonb;
  v_logs jsonb;
  v_drafts jsonb;
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

  SELECT COALESCE(jsonb_agg(to_jsonb(h)), '[]'::jsonb) INTO v_drafts
  FROM public.hermes_drafts h
  WHERE public.normalizar_telefone(COALESCE(h.telefone,'')) ILIKE '%' || v_last8;

  SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb) INTO v_intents
  FROM public.conversation_intents i
  WHERE public.normalizar_telefone(i.telefone) ILIKE '%' || v_last8;

  PERFORM public.lgpd_log('exportar_dados', p_telefone, jsonb_build_object(
    'agendamentos', jsonb_array_length(v_agendamentos),
    'mensagens', jsonb_array_length(v_mensagens),
    'audit_logs', jsonb_array_length(v_logs),
    'hermes_drafts', jsonb_array_length(v_drafts),
    'intents', jsonb_array_length(v_intents)
  ));

  RETURN jsonb_build_object(
    'telefone', p_telefone,
    'gerado_em', now(),
    'agendamentos', v_agendamentos,
    'mensagens_whatsapp', v_mensagens,
    'crm_audit_log', v_logs,
    'hermes_drafts', v_drafts,
    'conversation_intents', v_intents
  );
END;
$$;

-- Anonimizar (direito ao esquecimento)
CREATE OR REPLACE FUNCTION public.apagar_dados_paciente(p_telefone text, p_confirmar boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_norm text;
  v_last8 text;
  v_ag_ids uuid[];
  v_count_ag int;
  v_count_msg int;
  v_count_drafts int;
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

  -- Anonimiza agendamentos
  UPDATE public.agendamentos
  SET nome_completo = '[ANONIMIZADO]',
      telefone_whatsapp = '[ANONIMIZADO]',
      email = NULL,
      data_nascimento = NULL,
      observacoes_internas = NULL,
      observacoes_internas_encrypted = NULL,
      updated_at = now()
  WHERE id = ANY(v_ag_ids);

  -- Anonimiza mensagens
  UPDATE public.mensagens_whatsapp
  SET telefone = '[ANONIMIZADO]',
      conteudo = '[ANONIMIZADO]',
      payload = NULL
  WHERE public.normalizar_telefone(telefone) ILIKE '%' || v_last8;
  GET DIAGNOSTICS v_count_msg = ROW_COUNT;

  -- Anonimiza hermes drafts
  UPDATE public.hermes_drafts
  SET telefone = '[ANONIMIZADO]',
      sugestao = '[ANONIMIZADO]',
      conteudo_final = NULL,
      contexto_resumo = NULL
  WHERE public.normalizar_telefone(COALESCE(telefone,'')) ILIKE '%' || v_last8;
  GET DIAGNOSTICS v_count_drafts = ROW_COUNT;

  -- Anonimiza intents
  UPDATE public.conversation_intents
  SET telefone = '[ANONIMIZADO]',
      resumo = NULL,
      raw_output = NULL
  WHERE public.normalizar_telefone(telefone) ILIKE '%' || v_last8;
  GET DIAGNOSTICS v_count_intents = ROW_COUNT;

  PERFORM public.lgpd_log('apagar_dados', p_telefone, jsonb_build_object(
    'agendamentos', v_count_ag,
    'mensagens', v_count_msg,
    'hermes_drafts', v_count_drafts,
    'intents', v_count_intents
  ));

  RETURN jsonb_build_object(
    'sucesso', true,
    'telefone_mascarado', public.mask_telefone(p_telefone),
    'agendamentos_anonimizados', v_count_ag,
    'mensagens_anonimizadas', v_count_msg,
    'drafts_anonimizados', v_count_drafts,
    'intents_anonimizados', v_count_intents
  );
END;
$$;

-- Pré-visualização (apenas conta, sem alterar)
CREATE OR REPLACE FUNCTION public.preview_dados_paciente(p_telefone text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_norm text; v_last8 text;
  v_ag int; v_msg int; v_drafts int; v_intents int; v_audit int;
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
  SELECT COUNT(*) INTO v_drafts FROM public.hermes_drafts WHERE public.normalizar_telefone(COALESCE(telefone,'')) ILIKE '%' || v_last8;
  SELECT COUNT(*) INTO v_intents FROM public.conversation_intents WHERE public.normalizar_telefone(telefone) ILIKE '%' || v_last8;
  SELECT COUNT(*) INTO v_audit FROM public.crm_audit_log WHERE agendamento_id IN (
    SELECT id FROM public.agendamentos WHERE public.normalizar_telefone(telefone_whatsapp) ILIKE '%' || v_last8
  );

  RETURN jsonb_build_object(
    'telefone_mascarado', public.mask_telefone(p_telefone),
    'agendamentos', v_ag,
    'mensagens', v_msg,
    'hermes_drafts', v_drafts,
    'intents', v_intents,
    'audit_logs', v_audit
  );
END;
$$;

-- Retenção automática
CREATE OR REPLACE FUNCTION public.aplicar_retencao_lgpd()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_logs_info int; v_logs_warn int; v_msgs int; v_rate int;
BEGIN
  DELETE FROM public.system_logs WHERE level='info' AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_logs_info = ROW_COUNT;
  DELETE FROM public.system_logs WHERE level IN ('warn','error','critical') AND created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_logs_warn = ROW_COUNT;
  DELETE FROM public.mensagens_whatsapp WHERE created_at < now() - interval '180 days';
  GET DIAGNOSTICS v_msgs = ROW_COUNT;
  DELETE FROM public.lgpd_rate_limit WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_rate = ROW_COUNT;

  INSERT INTO public.system_logs(level,category,source,message,details)
  VALUES('info','lgpd','retencao_automatica',
    'Retenção LGPD aplicada',
    jsonb_build_object('logs_info', v_logs_info, 'logs_warn_error', v_logs_warn, 'mensagens', v_msgs, 'rate_limit', v_rate));

  RETURN jsonb_build_object('logs_info', v_logs_info, 'logs_warn_error', v_logs_warn, 'mensagens', v_msgs, 'rate_limit', v_rate);
END;
$$;

-- Cron diário 03h
SELECT cron.unschedule('lgpd-retencao-diaria') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname='lgpd-retencao-diaria'
);
SELECT cron.schedule('lgpd-retencao-diaria', '0 3 * * *', $$ SELECT public.aplicar_retencao_lgpd(); $$);