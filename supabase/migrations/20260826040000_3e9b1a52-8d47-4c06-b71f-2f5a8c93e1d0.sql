-- 1) buscar_agendamento_por_telefone_norm
--
-- `n8n-resposta-confirmacao` carregava os 200 agendamentos mais recentes e
-- filtrava em JS pelos ultimos 8 digitos do telefone. Paciente cujo
-- agendamento nao estivesse nessa janela nunca era encontrado: o "Cancelar"
-- ou "Confirmar" dele era registrado como mensagem e descartado.
--
-- Mesmo criterio de desempate do JS que substitui, agora sobre a tabela
-- inteira: registro real antes de sandbox, com data antes de sem data, mais
-- recente antes de mais antigo.

CREATE OR REPLACE FUNCTION public.buscar_agendamento_por_telefone_norm(
  p_telefone_normalizado text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id
  FROM public.agendamentos a
  WHERE length(regexp_replace(COALESCE(p_telefone_normalizado, ''), '[^0-9]', '', 'g')) >= 8
    AND right(regexp_replace(COALESCE(a.telefone_whatsapp, ''), '[^0-9]', '', 'g'), 8)
      = right(regexp_replace(p_telefone_normalizado, '[^0-9]', '', 'g'), 8)
  ORDER BY
    COALESCE(a.is_sandbox, false) ASC,
    (a.data_agendamento IS NOT NULL) DESC,
    a.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.buscar_agendamento_por_telefone_norm(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_agendamento_por_telefone_norm(text) TO service_role;

-- 2) transicionar_estado_agendamento: mapear CANCELADO -> funil 'cancelado'
--
-- Ate agora nenhum cancelamento de paciente chegava a ser gravado (violava a
-- CHECK de confirmation_status). Corrigido isso, os cancelamentos passam a
-- acontecer de verdade — e sem esta linha o card ficaria com
-- status_crm='CANCELADO' e status_funil ainda 'agendado', ou seja, parado numa
-- coluna ativa do Kanban com a secretaria achando que o paciente vem.
--
-- Unica alteracao em relacao a versao da migration 20260712223249: a linha
-- WHEN 'CANCELADO'. `estado_atendimento` fica de fora de proposito — nao ha
-- valor definido para "cancelado" no vocabulario e inventar um seria pior.

CREATE OR REPLACE FUNCTION public.transicionar_estado_agendamento(
  p_id uuid,
  p_novo_status_crm text,
  p_motivo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_atual record;
  v_novo_funil text;
  v_novo_estado text;
  v_bot_ativo boolean;
BEGIN
  SELECT id, status_crm, status_funil, estado_atendimento, bot_ativo, data_agendamento
    INTO v_atual
  FROM public.agendamentos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'not_found');
  END IF;

  IF v_atual.status_funil = 'compareceu' AND p_novo_status_crm NOT IN ('ATENDIDO') THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'ja_compareceu', 'atual', v_atual.status_crm);
  END IF;
  IF v_atual.status_funil = 'agendado' AND v_atual.data_agendamento >= current_date
     AND p_novo_status_crm = 'NOVO LEAD' THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'agendado_futuro_nao_rebaixa');
  END IF;

  v_novo_funil := CASE p_novo_status_crm
    WHEN 'NOVO LEAD'          THEN 'novo'
    WHEN 'PRECISA_DE_HUMANO'  THEN COALESCE(v_atual.status_funil, 'novo')
    WHEN 'ATENDIDO'           THEN 'compareceu'
    WHEN 'CANCELADO'          THEN 'cancelado'
    WHEN 'YAG_LASER'          THEN 'agendado'
    ELSE COALESCE(v_atual.status_funil, 'novo')
  END;
  v_novo_estado := CASE p_novo_status_crm
    WHEN 'PRECISA_DE_HUMANO'  THEN 'humano'
    WHEN 'ATENDIDO'           THEN 'concluido'
    ELSE COALESCE(v_atual.estado_atendimento, 'novo')
  END;
  v_bot_ativo := CASE
    WHEN p_novo_status_crm = 'PRECISA_DE_HUMANO' THEN false
    ELSE COALESCE(v_atual.bot_ativo, true)
  END;

  UPDATE public.agendamentos
    SET status_crm = p_novo_status_crm,
        status_funil = v_novo_funil,
        estado_atendimento = v_novo_estado,
        bot_ativo = v_bot_ativo,
        bot_pausa_motivo = CASE WHEN v_bot_ativo = false THEN COALESCE(p_motivo, bot_pausa_motivo) ELSE bot_pausa_motivo END,
        updated_at = now()
  WHERE id = p_id;

  BEGIN
    INSERT INTO public.crm_audit_log (agendamento_id, acao, status_anterior, status_novo, detalhes)
    VALUES (p_id, 'transicionar_estado', v_atual.status_crm, p_novo_status_crm,
            jsonb_build_object('motivo', p_motivo));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'ok', true,
    'anterior', v_atual.status_crm,
    'novo', p_novo_status_crm,
    'funil', v_novo_funil,
    'estado', v_novo_estado,
    'bot_ativo', v_bot_ativo
  );
END $$;

REVOKE ALL ON FUNCTION public.transicionar_estado_agendamento(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transicionar_estado_agendamento(uuid, text, text) TO authenticated, service_role;
