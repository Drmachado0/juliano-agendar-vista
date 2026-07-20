-- ============================================================================
-- RC1 — AGENDADOR DE WELCOME / RETRY  (OPT-IN, DESLIGADO POR PADRÃO)
-- ============================================================================
-- ⚠️  ESTE ARQUIVO NÃO ESTÁ EM supabase/migrations/ DE PROPÓSITO.
--     Ele NÃO roda automaticamente. Rodá-lo cria os jobs de cron JÁ DESATIVADOS
--     (active = false), então mesmo executando este script NENHUMA mensagem é
--     enviada. Só passa a enviar quando você fizer `active = true` manualmente.
--
-- ⚠️  ANTES de ativar (active = true): peça pra adicionar o GUARD DE IDADE (48h)
--     no `enviar-boas-vindas-lead`, senão ao ligar ele manda welcome pra TODO o
--     backlog antigo (o que você pediu para NÃO fazer). Sem o guard, ligar isto
--     dispara para os ~19 leads antigos parados.
--
-- Segue o mesmo padrão do job `google-calendar-pull-15min` já usado no projeto:
-- wrapper SECURITY DEFINER que lê CRON_SECRET do vault e chama a edge function.
-- ============================================================================

-- Wrapper: welcome de leads
CREATE OR REPLACE FUNCTION public.trigger_enviar_boas_vindas_lead()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE NOTICE 'CRON_SECRET ausente — pulando enviar-boas-vindas-lead';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://cnpifhaszbonwlqruwnn.supabase.co/functions/v1/enviar-boas-vindas-lead',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb
  );
END;
$fn$;

-- Wrapper: retry de boas-vindas pendentes
CREATE OR REPLACE FUNCTION public.trigger_retentar_boas_vindas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE NOTICE 'CRON_SECRET ausente — pulando retentar-boas-vindas-pendentes';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://cnpifhaszbonwlqruwnn.supabase.co/functions/v1/retentar-boas-vindas-pendentes',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb
  );
END;
$fn$;

-- (Re)agenda os jobs — idempotente
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'welcome-lead-3min') THEN
    PERFORM cron.unschedule('welcome-lead-3min');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retry-welcome-5min') THEN
    PERFORM cron.unschedule('retry-welcome-5min');
  END IF;
END $$;

SELECT cron.schedule('welcome-lead-3min', '*/3 * * * *', $$ SELECT public.trigger_enviar_boas_vindas_lead(); $$);
SELECT cron.schedule('retry-welcome-5min', '*/5 * * * *', $$ SELECT public.trigger_retentar_boas_vindas(); $$);

-- 🚫 NASCEM DESLIGADOS: nada é enviado até você trocar para active = true.
UPDATE cron.job SET active = false WHERE jobname IN ('welcome-lead-3min', 'retry-welcome-5min');

-- ----------------------------------------------------------------------------
-- PARA ATIVAR (só depois do guard de 48h e com sua confirmação):
--   UPDATE cron.job SET active = true WHERE jobname IN ('welcome-lead-3min','retry-welcome-5min');
-- PARA DESATIVAR de novo:
--   UPDATE cron.job SET active = false WHERE jobname IN ('welcome-lead-3min','retry-welcome-5min');
-- ----------------------------------------------------------------------------
