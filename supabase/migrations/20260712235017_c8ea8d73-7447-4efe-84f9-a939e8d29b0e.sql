
-- ==============================================================
-- 20260712_crm_whatsapp_ajustes_auditoria
-- Ajustes finais da auditoria: terminais case-insensitive + saude_integracoes
-- ==============================================================

-- 1) vincular_mensagem_por_telefone — terminais case-insensitive
CREATE OR REPLACE FUNCTION public.vincular_mensagem_por_telefone(
  p_mensagem_id uuid,
  p_nome_contato text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $fn$
DECLARE
  v_tel_c text;
  v_agendamento_id uuid;
  v_count int;
  v_criado boolean := false;
  v_ambiguo boolean := false;
BEGIN
  SELECT telefone_canonico INTO v_tel_c
    FROM public.mensagens_whatsapp WHERE id = p_mensagem_id;
  IF v_tel_c IS NULL OR length(v_tel_c) < 10 THEN
    RETURN jsonb_build_object(
      'agendamento_id', NULL, 'criado', false, 'ambiguo', false,
      'total_matches', 0, 'motivo', 'telefone_invalido'
    );
  END IF;

  -- Lock por telefone canônico durante a transação
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tel_c, 0));

  -- Ativo = não sandbox E status_crm NÃO terminal (case-insensitive).
  -- Terminais: ATENDIDO, CANCELADO, COMPARECEU.
  SELECT count(*) INTO v_count
    FROM public.agendamentos
   WHERE telefone_canonico = v_tel_c
     AND is_sandbox IS NOT TRUE
     AND upper(coalesce(status_crm,'')) NOT IN ('ATENDIDO','CANCELADO','COMPARECEU');

  IF v_count = 1 THEN
    SELECT id INTO v_agendamento_id
      FROM public.agendamentos
     WHERE telefone_canonico = v_tel_c
       AND is_sandbox IS NOT TRUE
       AND upper(coalesce(status_crm,'')) NOT IN ('ATENDIDO','CANCELADO','COMPARECEU')
     LIMIT 1;
  ELSIF v_count = 0 THEN
    INSERT INTO public.agendamentos (
      nome_completo, telefone_whatsapp,
      tipo_atendimento, local_atendimento, convenio,
      status_crm, status_funil, estado_atendimento, origem
    ) VALUES (
      COALESCE(NULLIF(trim(p_nome_contato), ''), 'Lead WhatsApp'),
      v_tel_c, 'Consulta', 'A definir', 'Particular',
      'NOVO LEAD', 'novo', 'novo', 'whatsapp_inbound'
    )
    RETURNING id INTO v_agendamento_id;
    v_criado := true;
  ELSE
    -- >1 ativos → AMBÍGUO: NÃO vincula, NÃO mescla.
    v_ambiguo := true;
    v_agendamento_id := NULL;
  END IF;

  IF v_agendamento_id IS NOT NULL THEN
    UPDATE public.mensagens_whatsapp
      SET agendamento_id = v_agendamento_id
    WHERE id = p_mensagem_id AND agendamento_id IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'agendamento_id', v_agendamento_id,
    'criado', v_criado,
    'ambiguo', v_ambiguo,
    'total_matches', v_count
  );
END
$fn$;

REVOKE ALL ON FUNCTION public.vincular_mensagem_por_telefone(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_mensagem_por_telefone(uuid, text) TO service_role;

-- 2) saude_integracoes — out_confirmados sem 'solicitado';
--    pacientes_ultima_msg_in agrupa por telefone_canonico (inclui órfãos);
--    adiciona in_orfas_24h.
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
  in_orfas_24h                   integer,
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
  orfas24 AS (
    SELECT count(*)::int AS n FROM public.mensagens_whatsapp
     WHERE agendamento_id IS NULL AND direcao = 'IN'
       AND created_at > now() - interval '24 hours'
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
    -- OUT confirmadas: apenas entregas concretas (não 'solicitado', não 'erro')
    SELECT count(*)::int AS n FROM public.mensagens_whatsapp
     WHERE direcao = 'OUT'
       AND created_at > now() - interval '24 hours'
       AND status_envio IN ('enviado','entregue','lido')
  ),
  -- Última msg por telefone_canonico (48h), incluindo órfãos
  ultima_por_tel AS (
    SELECT DISTINCT ON (telefone_canonico) telefone_canonico, direcao
      FROM public.mensagens_whatsapp
     WHERE telefone_canonico IS NOT NULL
       AND created_at > now() - interval '48 hours'
     ORDER BY telefone_canonico, created_at DESC
  ),
  ultima_in AS (
    SELECT count(*)::int AS n FROM ultima_por_tel WHERE direcao = 'IN'
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
    (SELECT n FROM orfas),
    (SELECT n FROM aguardando),
    (SELECT n FROM intents),
    (SELECT s2xx FROM net24),
    (SELECT s4xx FROM net24),
    (SELECT s5xx FROM net24),
    (SELECT tout FROM net24),
    (SELECT created FROM ult),
    (SELECT status_code FROM ult),
    (SELECT n FROM out24),
    (SELECT n FROM ultima_in),
    (SELECT n FROM orfas24),
    now();
END
$fn$;

REVOKE ALL ON FUNCTION public.saude_integracoes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saude_integracoes() TO authenticated, service_role;

CREATE VIEW public.v_saude_integracoes AS
  SELECT * FROM public.saude_integracoes();
GRANT SELECT ON public.v_saude_integracoes TO authenticated;

COMMENT ON FUNCTION public.vincular_mensagem_por_telefone(uuid, text) IS
  'Vincula mensagem IN a agendamento ativo (não sandbox e status_crm NÃO terminal case-insensitive: ATENDIDO/CANCELADO/COMPARECEU). 0 ativos → cria NOVO LEAD; 1 vincula; >1 ambíguo sem vínculo.';
COMMENT ON FUNCTION public.saude_integracoes() IS
  'Métricas admin-only. out_confirmados_24h conta enviado/entregue/lido (NÃO solicitado). pacientes_ultima_msg_in agrupa por telefone_canonico (inclui órfãos). in_orfas_24h: IN sem agendamento nas últimas 24h.';
