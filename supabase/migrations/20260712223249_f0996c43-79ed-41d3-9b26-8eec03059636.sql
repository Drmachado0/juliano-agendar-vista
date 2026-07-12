
-- =============================================================================
-- FIX CRÍTICO CRM/WHATSAPP — 2026-07-12
-- 1) Registra CRON_SECRET no vault de segredos internos (integracao_secrets)
-- 2) Cria helper _cron_headers() para crons chamarem endpoints com segredo
-- 3) Recadastra crons de boas-vindas/retry/confirmação sem segredo literal
-- 4) telefone_canonico + coluna gerada + índice
-- 5) RPC vincular_mensagem_por_telefone (idempotente, com lock)
-- 6) RPC transicionar_estado_agendamento (mantém tri-campo coerente)
-- 7) RPC vincular_mensagens_orfas (dry-run seguro)
-- 8) Backfill: PRECISA_DE_HUMANO → bot_ativo=false
-- 9) View v_saude_integracoes (contagens pg_net 2xx/4xx/5xx, órfãs, aguardando)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) CRON_SECRET em integracao_secrets, gerado se ausente
-- ---------------------------------------------------------------------------
DO $mig$
DECLARE
  v_key text;
  v_novo text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.integracao_secrets WHERE nome = 'CRON_SECRET') THEN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'ENCRYPTION_KEY' LIMIT 1;
    IF v_key IS NULL THEN
      RAISE NOTICE 'ENCRYPTION_KEY ausente; pulando bootstrap do CRON_SECRET';
    ELSE
      v_novo := translate(encode(extensions.gen_random_bytes(48), 'base64'), '+/=', '-_');
      v_novo := replace(v_novo, E'\n', '');
      INSERT INTO public.integracao_secrets (nome, valor_encrypted, versao, rotacionado_em)
      VALUES ('CRON_SECRET', extensions.pgp_sym_encrypt(v_novo, v_key), 1, now());
    END IF;
  END IF;
END
$mig$;

-- ---------------------------------------------------------------------------
-- 2) Helper _cron_headers() — retorna jsonb {x-cron-secret: ...}
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._cron_headers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_enc bytea;
  v_val text;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'ENCRYPTION_KEY' LIMIT 1;
  SELECT valor_encrypted INTO v_enc FROM public.integracao_secrets WHERE nome = 'CRON_SECRET';
  IF v_key IS NULL OR v_enc IS NULL THEN
    RETURN jsonb_build_object('Content-Type', 'application/json');
  END IF;
  v_val := pgp_sym_decrypt(v_enc, v_key);
  RETURN jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', v_val,
    'Authorization', 'Bearer ' || v_val
  );
END $$;

REVOKE ALL ON FUNCTION public._cron_headers() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Recadastro dos crons usando _cron_headers()
-- ---------------------------------------------------------------------------
DO $mig$
DECLARE
  v_url_base constant text := 'https://cnpifhaszbonwlqruwnn.supabase.co/functions/v1/';
  v_jobs jsonb := jsonb_build_array(
    jsonb_build_object('name', 'cron-boas-vindas-lead',            'fn', 'enviar-boas-vindas-lead',            'sched', '*/5 * * * *'),
    jsonb_build_object('name', 'cron-retry-boas-vindas-pendentes', 'fn', 'retentar-boas-vindas-pendentes',     'sched', '*/10 * * * *'),
    jsonb_build_object('name', 'cron-confirmacao-whatsapp',        'fn', 'enviar-confirmacao-whatsapp',        'sched', '0 12 * * *'),
    jsonb_build_object('name', 'cron-lembrete-consulta',           'fn', 'lembrete-consulta-whatsapp',         'sched', '0 9 * * *')
  );
  r record;
BEGIN
  FOR r IN SELECT * FROM jsonb_to_recordset(v_jobs) AS x(name text, fn text, sched text) LOOP
    BEGIN
      PERFORM cron.unschedule(r.name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      PERFORM cron.schedule(
        r.name,
        r.sched,
        format($cron$
          SELECT net.http_post(
            url := %L,
            headers := public._cron_headers(),
            body := jsonb_build_object('ts', now(), 'src', 'pg_cron')
          );
        $cron$, v_url_base || r.fn)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha ao (re)agendar %: %', r.name, SQLERRM;
    END;
  END LOOP;
END
$mig$;

-- ---------------------------------------------------------------------------
-- 4) telefone_canonico
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.telefone_canonico(p_tel text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  d text;
BEGIN
  IF p_tel IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(p_tel, '\D', '', 'g');
  IF length(d) = 0 THEN RETURN NULL; END IF;
  -- remove DDI 55 se presente
  IF length(d) >= 12 AND left(d, 2) = '55' THEN d := substring(d from 3); END IF;
  -- Brasil: DDD (2) + número (8 ou 9). Adiciona 9 se DDD + 8 = 10 dígitos.
  IF length(d) = 10 THEN d := substring(d from 1 for 2) || '9' || substring(d from 3); END IF;
  -- se ficou fora de 10/11 dígitos, devolve os últimos 11 (fallback)
  IF length(d) > 11 THEN d := right(d, 11); END IF;
  RETURN d;
END $$;

-- coluna gerada em agendamentos (idempotente)
DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='agendamentos' AND column_name='telefone_canonico'
  ) THEN
    ALTER TABLE public.agendamentos
      ADD COLUMN telefone_canonico text GENERATED ALWAYS AS (public.telefone_canonico(telefone_whatsapp)) STORED;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='mensagens_whatsapp' AND column_name='telefone_canonico'
  ) THEN
    ALTER TABLE public.mensagens_whatsapp
      ADD COLUMN telefone_canonico text GENERATED ALWAYS AS (public.telefone_canonico(telefone)) STORED;
  END IF;
END
$mig$;

CREATE INDEX IF NOT EXISTS idx_agendamentos_tel_canonico
  ON public.agendamentos (telefone_canonico) WHERE telefone_canonico IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mensagens_wa_tel_canonico
  ON public.mensagens_whatsapp (telefone_canonico) WHERE telefone_canonico IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mensagens_wa_externa
  ON public.mensagens_whatsapp (mensagem_externa_id) WHERE mensagem_externa_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5) RPC vincular_mensagem_por_telefone
--    Retorna { agendamento_id, criado, ambiguo }.
--    Regra: 0 match → cria lead novo; 1 match ativo → vincula; >1 → ambiguo, NÃO merge.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vincular_mensagem_por_telefone(
  p_mensagem_id uuid,
  p_nome_contato text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
    RETURN jsonb_build_object('agendamento_id', NULL, 'criado', false, 'ambiguo', false, 'motivo', 'telefone_invalido');
  END IF;

  -- Match único e determinístico: exclui cancelados e sandbox
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
    FOR UPDATE SKIP LOCKED
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
    ) RETURNING id INTO v_agendamento_id;
    v_criado := true;
  ELSE
    v_ambiguo := true;
    -- Preferência determinística: prioriza o com data_agendamento futura mais próxima; senão o mais recente
    SELECT id INTO v_agendamento_id
    FROM public.agendamentos
    WHERE telefone_canonico = v_tel_c
      AND coalesce(status_crm,'') <> 'cancelado'
      AND is_sandbox IS NOT TRUE
    ORDER BY
      (data_agendamento IS NOT NULL) DESC,
      data_agendamento ASC NULLS LAST,
      created_at DESC
    LIMIT 1;
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
END $$;

REVOKE ALL ON FUNCTION public.vincular_mensagem_por_telefone(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_mensagem_por_telefone(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 6) RPC transicionar_estado_agendamento
--    Mantém status_crm, status_funil, estado_atendimento coerentes.
--    Guarda contra regressão de "compareceu"/"agendado".
--    PRECISA_DE_HUMANO → bot_ativo=false.
-- ---------------------------------------------------------------------------
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

  -- Guard: não rebaixa se já compareceu ou já agendado com data futura
  IF v_atual.status_funil = 'compareceu' AND p_novo_status_crm NOT IN ('ATENDIDO') THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'ja_compareceu', 'atual', v_atual.status_crm);
  END IF;
  IF v_atual.status_funil = 'agendado' AND v_atual.data_agendamento >= current_date
     AND p_novo_status_crm = 'NOVO LEAD' THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'agendado_futuro_nao_rebaixa');
  END IF;

  -- Mapeamento status_crm → funil/estado/bot
  v_novo_funil := CASE p_novo_status_crm
    WHEN 'NOVO LEAD'          THEN 'novo'
    WHEN 'PRECISA_DE_HUMANO'  THEN COALESCE(v_atual.status_funil, 'novo')
    WHEN 'ATENDIDO'           THEN 'compareceu'
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

-- ---------------------------------------------------------------------------
-- 7) RPC vincular_mensagens_orfas (admin-only, dry-run default)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vincular_mensagens_orfas(p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_candidatas int := 0;
  v_vinculadas int := 0;
  v_ambiguas int := 0;
  v_sem_match int := 0;
  r record;
  v_count int;
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  FOR r IN
    SELECT id, telefone_canonico
    FROM public.mensagens_whatsapp
    WHERE agendamento_id IS NULL
      AND telefone_canonico IS NOT NULL
      AND length(telefone_canonico) >= 10
    LIMIT 5000
  LOOP
    v_candidatas := v_candidatas + 1;
    SELECT count(*) INTO v_count
    FROM public.agendamentos
    WHERE telefone_canonico = r.telefone_canonico
      AND coalesce(status_crm,'') <> 'cancelado'
      AND is_sandbox IS NOT TRUE;
    IF v_count = 1 THEN
      SELECT id INTO v_id FROM public.agendamentos
        WHERE telefone_canonico = r.telefone_canonico
          AND coalesce(status_crm,'') <> 'cancelado'
          AND is_sandbox IS NOT TRUE LIMIT 1;
      IF NOT p_dry_run THEN
        UPDATE public.mensagens_whatsapp SET agendamento_id = v_id WHERE id = r.id;
      END IF;
      v_vinculadas := v_vinculadas + 1;
    ELSIF v_count = 0 THEN
      v_sem_match := v_sem_match + 1;
    ELSE
      v_ambiguas := v_ambiguas + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'candidatas', v_candidatas,
    'vinculadas', v_vinculadas,
    'ambiguas', v_ambiguas,
    'sem_match', v_sem_match
  );
END $$;

REVOKE ALL ON FUNCTION public.vincular_mensagens_orfas(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vincular_mensagens_orfas(boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8) Backfill: PRECISA_DE_HUMANO → bot_ativo=false
-- ---------------------------------------------------------------------------
UPDATE public.agendamentos
  SET bot_ativo = false,
      bot_pausa_motivo = COALESCE(bot_pausa_motivo, 'backfill_precisa_humano_2026_07_12'),
      updated_at = now()
WHERE status_crm = 'PRECISA_DE_HUMANO'
  AND (bot_ativo IS NULL OR bot_ativo = true);

-- ---------------------------------------------------------------------------
-- 9) View v_saude_integracoes — contagens pg_net, órfãs, aguardando resposta
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_saude_integracoes AS
WITH orfas AS (
  SELECT count(*)::int AS total
  FROM public.mensagens_whatsapp
  WHERE agendamento_id IS NULL AND direcao = 'IN'
),
aguardando AS (
  SELECT count(DISTINCT m.agendamento_id)::int AS total
  FROM public.mensagens_whatsapp m
  WHERE m.direcao = 'IN'
    AND m.agendamento_id IS NOT NULL
    AND m.created_at > now() - interval '48 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.mensagens_whatsapp m2
      WHERE m2.agendamento_id = m.agendamento_id
        AND m2.direcao = 'OUT'
        AND m2.created_at > m.created_at
    )
),
intents AS (
  SELECT count(*)::int AS total_24h
  FROM public.conversation_intents
  WHERE created_at > now() - interval '24 hours'
)
SELECT
  (SELECT total FROM orfas) AS mensagens_orfas,
  (SELECT total FROM aguardando) AS pacientes_aguardando_resposta,
  (SELECT total_24h FROM intents) AS intents_24h,
  now() AS gerado_em;

GRANT SELECT ON public.v_saude_integracoes TO authenticated;
REVOKE SELECT ON public.v_saude_integracoes FROM anon;
