
CREATE OR REPLACE FUNCTION public.auto_compareceu_vencidos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.agendamentos
    SET status_funil = 'compareceu',
        updated_at = now()
    WHERE status_funil = 'agendado'
      AND data_agendamento IS NOT NULL
      AND data_agendamento < current_date - interval '7 days'
      AND is_sandbox IS NOT TRUE
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM upd;

  IF v_count > 0 THEN
    INSERT INTO public.crm_audit_log (acao, status_anterior, status_novo, detalhes)
    VALUES (
      'auto_compareceu_vencidos',
      'agendado',
      'compareceu',
      jsonb_build_object('movidos', v_count, 'executed_at', now(), 'janela_dias', 7)
    );
  END IF;

  RETURN v_count;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto_compareceu_vencidos_diario') THEN
    PERFORM cron.unschedule('auto_compareceu_vencidos_diario');
  END IF;
END $$;

SELECT cron.schedule(
  'auto_compareceu_vencidos_diario',
  '0 3 * * *',
  $$SELECT public.auto_compareceu_vencidos();$$
);
