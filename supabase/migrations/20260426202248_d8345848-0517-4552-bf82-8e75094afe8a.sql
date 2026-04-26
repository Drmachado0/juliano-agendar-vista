-- Normaliza telefone (apenas dígitos) para comparação
CREATE OR REPLACE FUNCTION public.normalizar_telefone(p_telefone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(COALESCE(p_telefone, ''), '\D', '', 'g')
$$;

-- Detecta grupos de agendamentos duplicados por telefone normalizado
CREATE OR REPLACE FUNCTION public.detectar_duplicados_telefone()
RETURNS TABLE(
  telefone_normalizado text,
  total_duplicados bigint,
  agendamentos jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  WITH normalizados AS (
    SELECT
      a.id,
      public.normalizar_telefone(a.telefone_whatsapp) AS tel_norm,
      a.nome_completo,
      a.telefone_whatsapp,
      a.email,
      a.status_crm,
      a.status_funil,
      a.data_agendamento,
      a.hora_agendamento,
      a.local_atendimento,
      a.tipo_atendimento,
      a.created_at,
      a.updated_at
    FROM public.agendamentos a
    WHERE a.telefone_whatsapp IS NOT NULL
      AND length(public.normalizar_telefone(a.telefone_whatsapp)) >= 10
  ),
  grupos AS (
    SELECT tel_norm, COUNT(*) AS qtd
    FROM normalizados
    GROUP BY tel_norm
    HAVING COUNT(*) > 1
  )
  SELECT
    g.tel_norm AS telefone_normalizado,
    g.qtd AS total_duplicados,
    jsonb_agg(
      jsonb_build_object(
        'id', n.id,
        'nome_completo', n.nome_completo,
        'telefone_whatsapp', n.telefone_whatsapp,
        'email', n.email,
        'status_crm', n.status_crm,
        'status_funil', n.status_funil,
        'data_agendamento', n.data_agendamento,
        'hora_agendamento', n.hora_agendamento,
        'local_atendimento', n.local_atendimento,
        'tipo_atendimento', n.tipo_atendimento,
        'created_at', n.created_at,
        'updated_at', n.updated_at
      )
      ORDER BY
        -- prioridade: tem data agendada > mais recente
        (n.data_agendamento IS NOT NULL) DESC,
        n.created_at ASC
    ) AS agendamentos
  FROM grupos g
  JOIN normalizados n ON n.tel_norm = g.tel_norm
  GROUP BY g.tel_norm, g.qtd
  ORDER BY g.qtd DESC;
END;
$$;

-- Unifica duplicados: mantém o "principal" e remove os demais,
-- transferindo mensagens e auditoria.
-- Critério padrão de "principal": registro com data_agendamento; se nenhum, o mais antigo.
CREATE OR REPLACE FUNCTION public.unificar_duplicados(
  p_telefone_normalizado text,
  p_principal_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_principal_id uuid;
  v_removidos uuid[];
  v_msgs_movidas int;
  v_audit_movidas int;
  v_user_email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- Define o principal: parâmetro explícito > tem data > mais antigo
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

  -- IDs a remover (todos os duplicados exceto o principal)
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

  -- Transfere mensagens WhatsApp para o principal
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
$$;