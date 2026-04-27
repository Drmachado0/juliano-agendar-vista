-- Buscar agendamento existente pelo telefone (últimos 8 dígitos normalizados)
-- Usado para vincular conversas novas a leads existentes evitando duplicatas
CREATE OR REPLACE FUNCTION public.buscar_agendamento_por_telefone(p_telefone text)
RETURNS TABLE (
  id uuid,
  nome_completo text,
  telefone_whatsapp text,
  status_crm text,
  status_funil text,
  local_atendimento text,
  is_sandbox boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_last8 text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  v_norm := public.normalizar_telefone(p_telefone);
  IF v_norm IS NULL OR length(v_norm) < 8 THEN
    RETURN;
  END IF;

  v_last8 := right(v_norm, 8);

  RETURN QUERY
  SELECT
    a.id,
    a.nome_completo,
    a.telefone_whatsapp,
    a.status_crm,
    a.status_funil,
    a.local_atendimento,
    a.is_sandbox,
    a.created_at
  FROM public.agendamentos a
  WHERE public.normalizar_telefone(a.telefone_whatsapp) ILIKE '%' || v_last8
  ORDER BY
    -- prioriza não-sandbox, com data agendada, mais recente
    a.is_sandbox ASC,
    (a.data_agendamento IS NOT NULL) DESC,
    a.created_at DESC
  LIMIT 1;
END;
$$;

-- Criar lead manual via aba WhatsApp (sem passar pelo formulário do site)
-- Retorna o id do agendamento criado.
CREATE OR REPLACE FUNCTION public.criar_lead_manual_whatsapp(
  p_nome text,
  p_telefone text,
  p_is_sandbox boolean DEFAULT false,
  p_observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_norm text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF p_nome IS NULL OR length(trim(p_nome)) < 2 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;

  v_norm := public.normalizar_telefone(p_telefone);
  IF v_norm IS NULL OR length(v_norm) < 10 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;

  INSERT INTO public.agendamentos (
    nome_completo,
    telefone_whatsapp,
    tipo_atendimento,
    local_atendimento,
    convenio,
    origem,
    status_crm,
    status_funil,
    is_sandbox,
    sandbox_reason,
    observacoes_internas
  ) VALUES (
    trim(p_nome),
    p_telefone,
    'Consulta',
    'A definir',
    'Particular',
    'whatsapp_manual',
    'NOVO LEAD',
    'lead',
    COALESCE(p_is_sandbox, false),
    CASE WHEN p_is_sandbox THEN 'Lead criado manualmente via WhatsApp' ELSE NULL END,
    p_observacoes
  )
  RETURNING id INTO v_id;

  PERFORM public.registrar_crm_audit(
    v_id,
    'lead_manual_whatsapp',
    NULL,
    'NOVO LEAD',
    jsonb_build_object('telefone', p_telefone, 'is_sandbox', p_is_sandbox)
  );

  RETURN v_id;
END;
$$;