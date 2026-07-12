-- ==============================================================
-- 20260712_crm_whatsapp_corretiva
-- Correções bloqueadoras identificadas na revisão técnica.
-- Não edita migrations aplicadas — só adiciona/substitui via CREATE OR REPLACE
-- e drops idempotentes.
-- ==============================================================

-- 1) Vinculação idempotente COM lock e SEM merge em caso ambíguo
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

  -- Lock por telefone canônico durante a transação inteira.
  -- Serializa fluxos concorrentes para o mesmo lead (evita 2 cadastros para o mesmo telefone).
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tel_c, 0));

  -- Match determinístico após o lock
  SELECT count(*) INTO v_count
    FROM public.agendamentos
   WHERE telefone_canonico = v_tel_c
     AND coalesce(status_crm,'') <> 'cancelado'
     AND is_sandbox IS NOT TRUE;

  IF v_count = 1 THEN
    SELECT id INTO v_agendamento_id
      FROM public.agendamentos
     WHERE telefone_canonico = v_tel_c
       AND coalesce(status_crm,'') <> 'cancelado'
       AND is_sandbox IS NOT TRUE
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
    -- >1 matches ativos → AMBÍGUO: NÃO vincula. Deixa mensagem órfã para revisão manual.
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

-- 2) Idempotência forte: índices UNIQUE parciais
-- Pré-checagem: aborta a migration se ainda houver duplicados (proteção)
DO $check$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM (
    SELECT mensagem_externa_id FROM public.mensagens_whatsapp
     WHERE mensagem_externa_id IS NOT NULL
     GROUP BY mensagem_externa_id HAVING count(*) > 1
  ) x;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'mensagens_whatsapp: % mensagem_externa_id duplicadas — resolver antes do UNIQUE', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM (
    SELECT mensagem_id FROM public.conversation_intents
     WHERE mensagem_id IS NOT NULL
     GROUP BY mensagem_id HAVING count(*) > 1
  ) y;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'conversation_intents: % mensagem_id duplicados — resolver antes do UNIQUE', v_n;
  END IF;
END $check$;

DROP INDEX IF EXISTS public.idx_mensagens_wa_externa;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_mensagens_wa_externa
  ON public.mensagens_whatsapp(mensagem_externa_id)
  WHERE mensagem_externa_id IS NOT NULL;

DROP INDEX IF EXISTS public.idx_conversation_intents_mensagem_id;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conversation_intents_mensagem_id
  ON public.conversation_intents(mensagem_id)
  WHERE mensagem_id IS NOT NULL;

-- 3) Remover crons legados (nomes conhecidos com credenciais literais e duplicidade)
DO $drops$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT jobname FROM cron.job
     WHERE jobname IN (
       'enviar-boas-vindas-lead',
       'retentar-boas-vindas-pendentes-5min',
       'enviar-confirmacoes-whatsapp-15min',
       'lembrete-consulta-diario'
     )
  LOOP
    PERFORM cron.unschedule(r.jobname);
    RAISE NOTICE 'cron legado removido: %', r.jobname;
  END LOOP;
END $drops$;

-- 4) Máquina de estados completa
CREATE OR REPLACE FUNCTION public.transicionar_estado_agendamento(
  p_id uuid,
  p_novo_status_crm text,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $fn$
DECLARE
  v_atual record;
  v_novo_funil text;
  v_novo_estado text;
  v_bot_ativo boolean;
  v_novo text := upper(coalesce(p_novo_status_crm,''));
BEGIN
  SELECT id, status_crm, status_funil, estado_atendimento, bot_ativo, data_agendamento
    INTO v_atual
  FROM public.agendamentos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'not_found');
  END IF;

  -- Validação de estados suportados
  IF v_novo NOT IN (
    'NOVO LEAD','AGUARDANDO','PRECISA_DE_HUMANO',
    'CLINICOR','HGP','BELÉM','BELEM',
    'YAG_LASER','ATENDIDO','CANCELADO'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'status_invalido', 'valor', p_novo_status_crm);
  END IF;

  -- Guards de regressão
  IF v_atual.status_funil = 'compareceu' AND v_novo NOT IN ('ATENDIDO','CANCELADO') THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'ja_compareceu', 'atual', v_atual.status_crm);
  END IF;
  IF v_atual.status_funil = 'agendado' AND v_atual.data_agendamento >= current_date
     AND v_novo = 'NOVO LEAD' THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'agendado_futuro_nao_rebaixa');
  END IF;

  -- Normaliza BELEM
  IF v_novo = 'BELEM' THEN v_novo := 'BELÉM'; END IF;

  -- Mapa completo status_crm → status_funil / estado_atendimento / bot_ativo
  v_novo_funil := CASE v_novo
    WHEN 'NOVO LEAD'         THEN 'novo'
    WHEN 'AGUARDANDO'        THEN 'aguardando'
    WHEN 'PRECISA_DE_HUMANO' THEN COALESCE(v_atual.status_funil, 'aguardando_humano')
    WHEN 'CLINICOR'          THEN 'agendado'
    WHEN 'HGP'               THEN 'agendado'
    WHEN 'BELÉM'             THEN 'agendado'
    WHEN 'YAG_LASER'         THEN 'agendado'
    WHEN 'ATENDIDO'          THEN 'compareceu'
    WHEN 'CANCELADO'         THEN 'cancelado'
    ELSE v_atual.status_funil
  END;

  v_novo_estado := CASE v_novo
    WHEN 'PRECISA_DE_HUMANO' THEN 'humano'
    WHEN 'AGUARDANDO'        THEN 'bot'
    WHEN 'ATENDIDO'          THEN 'concluido'
    WHEN 'CANCELADO'         THEN 'cancelado'
    WHEN 'CLINICOR'          THEN 'humano'
    WHEN 'HGP'               THEN 'humano'
    WHEN 'BELÉM'             THEN 'humano'
    WHEN 'YAG_LASER'         THEN 'humano'
    ELSE COALESCE(v_atual.estado_atendimento, 'novo')
  END;

  v_bot_ativo := CASE
    WHEN v_novo = 'PRECISA_DE_HUMANO' THEN false
    WHEN v_novo IN ('CLINICOR','HGP','BELÉM','YAG_LASER','ATENDIDO','CANCELADO') THEN false
    WHEN v_novo = 'AGUARDANDO' THEN true
    ELSE COALESCE(v_atual.bot_ativo, true)
  END;

  UPDATE public.agendamentos
    SET status_crm         = v_novo,
        status_funil       = v_novo_funil,
        estado_atendimento = v_novo_estado,
        bot_ativo          = v_bot_ativo,
        bot_pausa_motivo   = CASE WHEN v_bot_ativo = false
                                  THEN COALESCE(p_motivo, bot_pausa_motivo)
                                  ELSE bot_pausa_motivo END,
        updated_at         = now()
  WHERE id = p_id;

  BEGIN
    INSERT INTO public.crm_audit_log (agendamento_id, acao, status_anterior, status_novo, detalhes)
    VALUES (p_id, 'transicionar_estado', v_atual.status_crm, v_novo,
            jsonb_build_object('motivo', p_motivo));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'ok', true,
    'anterior', v_atual.status_crm,
    'novo', v_novo,
    'funil', v_novo_funil,
    'estado', v_novo_estado,
    'bot_ativo', v_bot_ativo
  );
END
$fn$;

-- 5) Observabilidade: função admin-only com contagens pg_net 24 h + view
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
    now();
END
$fn$;

REVOKE ALL ON FUNCTION public.saude_integracoes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saude_integracoes() TO authenticated, service_role;

-- Recria a view em cima da função (mantém compatibilidade com UI atual)
DROP VIEW IF EXISTS public.v_saude_integracoes;
CREATE VIEW public.v_saude_integracoes AS
  SELECT * FROM public.saude_integracoes();
GRANT SELECT ON public.v_saude_integracoes TO authenticated;
