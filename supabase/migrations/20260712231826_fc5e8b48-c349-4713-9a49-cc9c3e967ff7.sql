
-- =============================================================================
-- ManyChat/n8n outbound: idempotência por provider + provider_message_id
-- =============================================================================
ALTER TABLE public.mensagens_whatsapp
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

-- Backfill provider: quando payload contém canal manychat ou subscriber_id, marca 'manychat'
UPDATE public.mensagens_whatsapp
   SET provider = 'manychat'
 WHERE provider IS NULL
   AND direcao = 'OUT'
   AND (
     (payload->>'canal') ILIKE '%manychat%'
     OR (payload ? 'subscriber_id')
     OR (payload->>'origem') ILIKE '%manychat%'
   );

-- Índice UNIQUE parcial (provider, provider_message_id) — ambos NOT NULL
DO $$
DECLARE v_dup int;
BEGIN
  SELECT count(*) INTO v_dup FROM (
    SELECT provider, provider_message_id
      FROM public.mensagens_whatsapp
     WHERE provider IS NOT NULL AND provider_message_id IS NOT NULL
     GROUP BY provider, provider_message_id HAVING count(*) > 1
  ) t;
  IF v_dup > 0 THEN
    RAISE NOTICE '[mensagens_whatsapp] % duplicatas de (provider,provider_message_id) — deduplicando antes do UNIQUE', v_dup;
    -- Mantém a linha mais antiga; anula provider_message_id das demais para não bloquear o índice
    WITH ranked AS (
      SELECT id, row_number() OVER (
               PARTITION BY provider, provider_message_id
               ORDER BY created_at ASC, id ASC
             ) AS rn
        FROM public.mensagens_whatsapp
       WHERE provider IS NOT NULL AND provider_message_id IS NOT NULL
    )
    UPDATE public.mensagens_whatsapp m
       SET provider_message_id = NULL
      FROM ranked r
     WHERE m.id = r.id AND r.rn > 1;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS mensagens_whatsapp_provider_msgid_uniq
  ON public.mensagens_whatsapp(provider, provider_message_id)
  WHERE provider IS NOT NULL AND provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS mensagens_whatsapp_provider_idx
  ON public.mensagens_whatsapp(provider)
  WHERE provider IS NOT NULL;

-- =============================================================================
-- Amplia saude_integracoes: OUT confirmados 24h + pacientes com última msg IN
-- Mantém compatibilidade adicionando colunas no final; v_saude_integracoes é
-- recriada em cima da função.
-- =============================================================================
DROP VIEW IF EXISTS public.v_saude_integracoes;
DROP FUNCTION IF EXISTS public.saude_integracoes();

CREATE OR REPLACE FUNCTION public.saude_integracoes()
RETURNS TABLE (
  mensagens_orfas                integer,
  pacientes_aguardando_resposta  integer,
  intents_24h                    integer,
  net_2xx_24h                    integer,
  net_4xx_24h                    integer,
  net_5xx_24h                    integer,
  net_timeouts_24h               integer,
  net_ultimo_erro_at             timestamptz,
  net_ultimo_erro_status         integer,
  out_confirmados_24h            integer,
  pacientes_ultima_msg_in        integer,
  gerado_em                      timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public','net','pg_temp'
AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  WITH orfas AS (
    SELECT count(*)::int AS n FROM public.mensagens_whatsapp
     WHERE agendamento_id IS NULL AND direcao = 'IN'
  ),
  aguardando AS (
    SELECT count(DISTINCT m.agendamento_id)::int AS n
    FROM public.mensagens_whatsapp m
    WHERE m.direcao = 'IN'
      AND m.agendamento_id IS NOT NULL
      AND m.created_at > now() - interval '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.mensagens_whatsapp m2
         WHERE m2.agendamento_id = m.agendamento_id
           AND m2.direcao = 'OUT'
           AND m2.created_at > m.created_at)
  ),
  intents AS (
    SELECT count(*)::int AS n FROM public.conversation_intents
     WHERE created_at > now() - interval '24 hours'
  ),
  out24 AS (
    SELECT count(*)::int AS n FROM public.mensagens_whatsapp
     WHERE direcao = 'OUT'
       AND created_at > now() - interval '24 hours'
       AND status_envio IN ('enviado','entregue','lido','solicitado')
  ),
  ultima_por_agend AS (
    SELECT DISTINCT ON (agendamento_id) agendamento_id, direcao
      FROM public.mensagens_whatsapp
     WHERE agendamento_id IS NOT NULL
       AND created_at > now() - interval '48 hours'
     ORDER BY agendamento_id, created_at DESC
  ),
  ultima_in AS (
    SELECT count(*)::int AS n FROM ultima_por_agend WHERE direcao = 'IN'
  ),
  net24 AS (
    SELECT
      count(*) FILTER (WHERE status_code BETWEEN 200 AND 299)::int AS s2xx,
      count(*) FILTER (WHERE status_code BETWEEN 400 AND 499)::int AS s4xx,
      count(*) FILTER (WHERE status_code >= 500)::int             AS s5xx,
      count(*) FILTER (WHERE timed_out IS TRUE)::int              AS tout
    FROM net._http_response
    WHERE created > now() - interval '24 hours'
  ),
  ult AS (
    SELECT created, status_code
      FROM net._http_response
     WHERE created > now() - interval '24 hours'
       AND (status_code >= 400 OR timed_out IS TRUE)
     ORDER BY created DESC LIMIT 1
  )
  SELECT
    (SELECT n FROM orfas), (SELECT n FROM aguardando), (SELECT n FROM intents),
    (SELECT s2xx FROM net24), (SELECT s4xx FROM net24),
    (SELECT s5xx FROM net24), (SELECT tout FROM net24),
    (SELECT created FROM ult), (SELECT status_code FROM ult),
    (SELECT n FROM out24), (SELECT n FROM ultima_in),
    now();
END
$fn$;

REVOKE ALL ON FUNCTION public.saude_integracoes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saude_integracoes() TO authenticated, service_role;

CREATE VIEW public.v_saude_integracoes AS
  SELECT * FROM public.saude_integracoes();
GRANT SELECT ON public.v_saude_integracoes TO authenticated;

COMMENT ON COLUMN public.mensagens_whatsapp.provider IS 'Canal de origem/entrega (ex: manychat, evolution). Usado com provider_message_id para idempotência.';
COMMENT ON COLUMN public.mensagens_whatsapp.provider_message_id IS 'ID do envio no provedor (message_id do ManyChat). UNIQUE parcial junto de provider.';
