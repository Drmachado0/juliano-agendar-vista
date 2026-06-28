
CREATE OR REPLACE FUNCTION public.unificar_duplicados(p_telefone_normalizado text, p_principal_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_principal_id uuid;
  v_removidos uuid[];
  v_msgs_movidas int;
  v_audit_movidas int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF p_principal_id IS NOT NULL THEN
    v_principal_id := p_principal_id;
  ELSE
    SELECT a.id INTO v_principal_id
    FROM public.agendamentos a
    WHERE public.normalizar_telefone(a.telefone_whatsapp) = p_telefone_normalizado
    ORDER BY (a.data_agendamento IS NOT NULL) DESC, a.created_at ASC
    LIMIT 1;
  END IF;

  IF v_principal_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum agendamento encontrado para o telefone informado';
  END IF;

  SELECT array_agg(a.id) INTO v_removidos
  FROM public.agendamentos a
  WHERE public.normalizar_telefone(a.telefone_whatsapp) = p_telefone_normalizado
    AND a.id <> v_principal_id;

  IF v_removidos IS NULL OR array_length(v_removidos, 1) = 0 THEN
    RETURN jsonb_build_object(
      'principal_id', v_principal_id,
      'removidos', '[]'::jsonb,
      'mensagens_movidas', 0,
      'audit_movidas', 0,
      'mensagem', 'Nenhum duplicado encontrado'
    );
  END IF;

  -- 1) Deduplicar mensagens automáticas únicas por tipo antes do UPDATE,
  --    para não violar os índices únicos parciais de mensagens_whatsapp.
  WITH grupo AS (
    SELECT m.id,
           row_number() OVER (
             PARTITION BY m.tipo_mensagem
             ORDER BY (m.agendamento_id = v_principal_id) DESC, m.created_at ASC
           ) AS rn
    FROM public.mensagens_whatsapp m
    WHERE m.direcao = 'OUT'
      AND m.tipo_mensagem IN ('boas_vindas','confirmacao','lembrete_24h','lembrete_2h','agradecimento')
      AND (m.agendamento_id = v_principal_id OR m.agendamento_id = ANY(v_removidos))
  )
  DELETE FROM public.mensagens_whatsapp
  WHERE id IN (SELECT id FROM grupo WHERE rn > 1);

  -- 2) Mover bot_assistente_log para o principal (FK sem ON DELETE CASCADE).
  UPDATE public.bot_assistente_log
  SET agendamento_id = v_principal_id
  WHERE agendamento_id = ANY(v_removidos);

  -- Transfere mensagens WhatsApp restantes para o principal
  UPDATE public.mensagens_whatsapp
  SET agendamento_id = v_principal_id
  WHERE agendamento_id = ANY(v_removidos);
  GET DIAGNOSTICS v_msgs_movidas = ROW_COUNT;

  -- Transfere logs de auditoria existentes
  UPDATE public.crm_audit_log
  SET agendamento_id = v_principal_id
  WHERE agendamento_id = ANY(v_removidos);
  GET DIAGNOSTICS v_audit_movidas = ROW_COUNT;

  -- Remove os duplicados
  DELETE FROM public.agendamentos WHERE id = ANY(v_removidos);

  -- Registra no audit log
  PERFORM public.registrar_crm_audit(
    v_principal_id,
    'merge_duplicates',
    NULL,
    NULL,
    jsonb_build_object(
      'telefone_normalizado', p_telefone_normalizado,
      'removidos', to_jsonb(v_removidos),
      'mensagens_movidas', v_msgs_movidas,
      'audit_movidas', v_audit_movidas
    )
  );

  RETURN jsonb_build_object(
    'principal_id', v_principal_id,
    'removidos', to_jsonb(v_removidos),
    'mensagens_movidas', v_msgs_movidas,
    'audit_movidas', v_audit_movidas
  );
END;
$function$;
