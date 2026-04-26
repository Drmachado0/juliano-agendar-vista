-- Função principal: lista entradas do log com filtros server-side e join em agendamentos
CREATE OR REPLACE FUNCTION public.listar_crm_audit(
  p_search text DEFAULT NULL,
  p_acao text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_status_anterior text DEFAULT NULL,
  p_status_novo text DEFAULT NULL,
  p_data_inicio timestamptz DEFAULT NULL,
  p_data_fim timestamptz DEFAULT NULL,
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  agendamento_id uuid,
  user_id uuid,
  user_email text,
  user_name text,
  acao text,
  status_anterior text,
  status_novo text,
  detalhes jsonb,
  created_at timestamptz,
  paciente_nome text,
  paciente_telefone text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search_norm text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- Normaliza telefone do search (apenas dígitos) para casar com normalizar_telefone
  v_search_norm := NULLIF(regexp_replace(COALESCE(p_search, ''), '\D', '', 'g'), '');

  RETURN QUERY
  SELECT
    l.id,
    l.agendamento_id,
    l.user_id,
    l.user_email,
    l.user_name,
    l.acao,
    l.status_anterior,
    l.status_novo,
    l.detalhes,
    l.created_at,
    a.nome_completo AS paciente_nome,
    a.telefone_whatsapp AS paciente_telefone
  FROM public.crm_audit_log l
  LEFT JOIN public.agendamentos a ON a.id = l.agendamento_id
  WHERE (p_acao IS NULL OR l.acao = p_acao)
    AND (p_user_id IS NULL OR l.user_id = p_user_id)
    AND (p_status_anterior IS NULL OR l.status_anterior = p_status_anterior)
    AND (p_status_novo IS NULL OR l.status_novo = p_status_novo)
    AND (p_data_inicio IS NULL OR l.created_at >= p_data_inicio)
    AND (p_data_fim IS NULL OR l.created_at <= p_data_fim)
    AND (
      p_search IS NULL OR p_search = '' OR (
        a.nome_completo ILIKE '%' || p_search || '%'
        OR (
          v_search_norm IS NOT NULL
          AND length(v_search_norm) >= 3
          AND public.normalizar_telefone(a.telefone_whatsapp) ILIKE '%' || v_search_norm || '%'
        )
      )
    )
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
END;
$$;

-- Função auxiliar: lista usuários distintos que já registraram ações no log
CREATE OR REPLACE FUNCTION public.listar_crm_audit_users()
RETURNS TABLE (
  user_id uuid,
  user_name text,
  user_email text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (l.user_id)
    l.user_id,
    l.user_name,
    l.user_email
  FROM public.crm_audit_log l
  WHERE l.user_id IS NOT NULL
  ORDER BY l.user_id, l.created_at DESC;
END;
$$;