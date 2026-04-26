-- Remove job antigo se existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'google-calendar-pull-15min') THEN
    PERFORM cron.unschedule('google-calendar-pull-15min');
  END IF;
END $$;

-- Função wrapper que lê o CRON_SECRET do vault e dispara a edge function
CREATE OR REPLACE FUNCTION public.trigger_google_calendar_pull()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'CRON_SECRET'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE NOTICE 'CRON_SECRET não encontrado no vault — pulando google-calendar-pull';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://cnpifhaszbonwlqruwnn.supabase.co/functions/v1/google-calendar-pull',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb
  );
END;
$fn$;

-- Agenda o job a cada 15 minutos
SELECT cron.schedule(
  'google-calendar-pull-15min',
  '*/15 * * * *',
  $$ SELECT public.trigger_google_calendar_pull(); $$
);