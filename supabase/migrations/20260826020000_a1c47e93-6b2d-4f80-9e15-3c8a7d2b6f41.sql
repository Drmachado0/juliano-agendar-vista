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
