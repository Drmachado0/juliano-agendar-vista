-- supabase/migrations/20260826020000_a1c47e93-6b2d-4f80-9e15-3c8a7d2b6f41.sql
-- Lembrete de vespera: 06:00 -> 09:00, horario de Belem.
--
-- O cron `cron-lembrete-consulta` rodava em '0 9 * * *'. pg_cron agenda em UTC
-- e Belem e UTC-3, entao o paciente recebia o lembrete as 06:00 da manha.
-- '0 12 * * *' coloca em 09:00 local, mesmo horario do cron de confirmacao.
--
-- Reaproveita `public._cron_headers()`, criada na migration 20260712223249.

DO $mig$
DECLARE
  v_url constant text :=
    'https://cnpifhaszbonwlqruwnn.supabase.co/functions/v1/lembrete-consulta-whatsapp';
BEGIN
  BEGIN
    PERFORM cron.unschedule('cron-lembrete-consulta');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule(
    'cron-lembrete-consulta',
    '0 12 * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := public._cron_headers(),
        body := jsonb_build_object('ts', now(), 'src', 'pg_cron')
      );
    $cron$, v_url)
  );
END $mig$;

-- supabase/migrations/20260826040000_3e9b1a52-8d47-4c06-b71f-2f5a8c93e1d0.sql
-- 1) buscar_agendamento_por_telefone_norm

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