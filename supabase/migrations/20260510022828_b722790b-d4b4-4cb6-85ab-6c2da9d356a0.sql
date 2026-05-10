BEGIN;

-- =====================================================================
-- [1] VIEW CONSOLIDADA — vw_crm_kanban
-- =====================================================================
CREATE OR REPLACE VIEW public.vw_crm_kanban AS
WITH ultima_msg AS (
  SELECT DISTINCT ON (agendamento_id)
         agendamento_id,
         conteudo                     AS ultima_msg,
         direcao                      AS ultima_msg_direcao,
         created_at                   AS ultima_msg_at,
         lida                         AS ultima_msg_lida
    FROM public.mensagens_whatsapp
   WHERE agendamento_id IS NOT NULL
   ORDER BY agendamento_id, created_at DESC
),
contagem_msg AS (
  SELECT agendamento_id, COUNT(*) AS total_mensagens
    FROM public.mensagens_whatsapp
   WHERE agendamento_id IS NOT NULL
   GROUP BY agendamento_id
)
SELECT
  a.id                              AS agendamento_id,
  a.nome_completo                   AS nome,
  a.telefone_whatsapp               AS telefone,
  a.email,
  a.data_nascimento,
  a.tipo_atendimento,
  a.detalhe_exame_ou_cirurgia,
  a.local_atendimento               AS unidade,
  a.convenio,
  a.convenio_outro,
  a.data_agendamento,
  a.hora_agendamento,
  a.status_crm,
  a.status_funil,
  a.origem,
  a.confirmation_status,
  a.confirmacao_enviada,
  a.bot_ativo,
  a.bot_pausado_ate,
  a.is_sandbox,
  a.utm_source, a.utm_medium, a.utm_campaign, a.utm_term, a.utm_content,
  a.gclid, a.fbclid, a.fbp, a.fbc,
  a.landing_page, a.referrer,
  a.clinica_id, a.profissional_id, a.servico_id,
  c.nome                            AS clinica_nome,
  s.nome                            AS servico_nome,
  pr.nome                           AS profissional_nome,
  cv.valor_consulta                 AS valor_convenio,
  COALESCE(cm.total_mensagens, 0)   AS total_mensagens,
  um.ultima_msg,
  um.ultima_msg_direcao,
  um.ultima_msg_at,
  um.ultima_msg_lida,
  a.created_at,
  a.updated_at,
  CASE
    WHEN a.status_crm IN ('ATENDIDO','atendido','CONCLUIDO','concluido')
         OR a.status_funil IN ('finalizado','atendido')
      THEN 'ATENDIDO'
    WHEN a.status_crm ILIKE '%humano%'
         OR (a.bot_pausado_ate IS NOT NULL AND a.bot_pausado_ate > now())
      THEN 'PRECISA DE HUMANO'
    WHEN a.status_crm = 'NOVO LEAD'
      THEN 'NOVO LEAD'
    WHEN a.data_agendamento IS NULL
      THEN 'AGUARDANDO'
    WHEN a.local_atendimento ILIKE 'clinicor%' THEN 'CLINICOR'
    WHEN a.local_atendimento ILIKE 'hgp%'      THEN 'HGP'
    WHEN a.local_atendimento ILIKE 'bel%m%'    THEN 'BELÉM'
    ELSE 'AGUARDANDO'
  END AS coluna_kanban
FROM public.agendamentos a
LEFT JOIN public.clinicas       c  ON c.id  = a.clinica_id
LEFT JOIN public.servicos       s  ON s.id  = a.servico_id
LEFT JOIN public.profissionais  pr ON pr.id = a.profissional_id
LEFT JOIN public.convenios      cv ON cv.slug = lower(a.convenio)
LEFT JOIN ultima_msg            um ON um.agendamento_id = a.id
LEFT JOIN contagem_msg          cm ON cm.agendamento_id = a.id
WHERE a.is_sandbox = false;

COMMENT ON VIEW public.vw_crm_kanban IS
  'View unificada para o Kanban CRM. Front consome com 1 SELECT e escuta Realtime em agendamentos/mensagens_whatsapp.';

GRANT SELECT ON public.vw_crm_kanban TO authenticated, service_role;

CREATE OR REPLACE VIEW public.vw_crm_kanban_all AS
SELECT
  vk.*,
  a.is_sandbox AS is_sandbox_raw,
  a.sandbox_reason
FROM public.agendamentos a
LEFT JOIN public.vw_crm_kanban vk ON vk.agendamento_id = a.id;
GRANT SELECT ON public.vw_crm_kanban_all TO authenticated, service_role;


-- =====================================================================
-- [2] RPC UNIFICADA — crm_ingest_lead
-- =====================================================================
CREATE OR REPLACE FUNCTION public.crm_ingest_lead(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel_raw   text;
  v_tel_norm  text;
  v_nome      text;
  v_data      date;
  v_hora      time;
  v_clinica   uuid;
  v_existente uuid;
  v_agend_id  uuid;
  v_msg_id    uuid;
  v_msg       text;
  v_meta      jsonb;
  v_utm       jsonb;
  v_criado    boolean := true;
BEGIN
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'payload inválido: deve ser objeto JSON';
  END IF;

  v_tel_raw := payload->>'telefone_whatsapp';
  IF v_tel_raw IS NULL OR length(regexp_replace(v_tel_raw,'\D','','g')) < 10 THEN
    RAISE EXCEPTION 'telefone_whatsapp ausente ou inválido (recebido: %)', v_tel_raw;
  END IF;

  BEGIN
    v_tel_norm := public.normalizar_telefone(v_tel_raw);
  EXCEPTION WHEN undefined_function THEN
    v_tel_norm := regexp_replace(v_tel_raw,'\D','','g');
  END;

  v_nome    := nullif(trim(coalesce(payload->>'nome_completo','')), '');
  IF v_nome IS NULL THEN v_nome := 'Lead Externo'; END IF;

  v_data    := nullif(payload->>'data_agendamento','')::date;
  v_hora    := nullif(payload->>'hora_agendamento','')::time;
  v_clinica := nullif(payload->>'clinica_id','')::uuid;

  v_msg     := nullif(payload->>'mensagem_inicial','');
  v_meta    := coalesce(payload->'metadata_msg', '{}'::jsonb);
  v_utm     := coalesce(payload->'utm', '{}'::jsonb);

  IF v_data IS NOT NULL AND v_hora IS NOT NULL AND v_clinica IS NOT NULL THEN
    SELECT id INTO v_existente
      FROM public.agendamentos
     WHERE telefone_whatsapp = v_tel_norm
       AND data_agendamento  = v_data
       AND hora_agendamento  = v_hora
       AND clinica_id        = v_clinica
       AND status_crm <> 'cancelado'
     LIMIT 1;
  END IF;

  IF v_existente IS NOT NULL THEN
    v_agend_id := v_existente;
    v_criado   := false;
  ELSE
    INSERT INTO public.agendamentos (
      nome_completo, telefone_whatsapp, email, data_nascimento,
      tipo_atendimento, detalhe_exame_ou_cirurgia,
      local_atendimento, convenio, convenio_outro,
      data_agendamento, hora_agendamento,
      aceita_primeiro_horario, aceita_contato_whatsapp_email,
      status_crm, origem,
      clinica_id, profissional_id, servico_id,
      is_sandbox,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      gclid, fbclid, gbraid, wbraid, fbp, fbc,
      landing_page, referrer
    ) VALUES (
      v_nome,
      v_tel_norm,
      nullif(payload->>'email',''),
      nullif(payload->>'data_nascimento','')::date,
      coalesce(nullif(payload->>'tipo_atendimento',''), 'consulta'),
      nullif(payload->>'detalhe_exame_ou_cirurgia',''),
      coalesce(nullif(payload->>'local_atendimento',''), 'A definir'),
      coalesce(nullif(payload->>'convenio',''), 'Particular'),
      nullif(payload->>'convenio_outro',''),
      v_data, v_hora,
      coalesce((payload->>'aceita_primeiro_horario')::boolean, false),
      coalesce((payload->>'aceita_contato_whatsapp_email')::boolean, true),
      coalesce(nullif(payload->>'status_crm',''), 'NOVO LEAD'),
      coalesce(nullif(payload->>'origem',''), 'externo'),
      v_clinica,
      nullif(payload->>'profissional_id','')::uuid,
      nullif(payload->>'servico_id','')::uuid,
      coalesce((payload->>'is_sandbox')::boolean, false),
      v_utm->>'source', v_utm->>'medium', v_utm->>'campaign', v_utm->>'term', v_utm->>'content',
      payload->>'gclid', payload->>'fbclid', payload->>'gbraid', payload->>'wbraid',
      payload->>'fbp', payload->>'fbc',
      payload->>'landing_page', payload->>'referrer'
    )
    RETURNING id INTO v_agend_id;
  END IF;

  IF v_msg IS NOT NULL THEN
    BEGIN
      v_msg_id := public.registrar_mensagem_whatsapp(
        p_telefone           := v_tel_norm,
        p_direcao            := 'IN',
        p_conteudo           := v_msg,
        p_tipo_mensagem      := coalesce(payload->>'tipo_mensagem','recebida'),
        p_agendamento_id     := v_agend_id,
        p_status_envio       := 'recebido',
        p_mensagem_externa_id:= payload->>'mensagem_externa_id',
        p_error_message      := NULL,
        p_payload            := v_meta
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.mensagens_whatsapp (
        agendamento_id, telefone, direcao, conteudo, tipo_mensagem, status_envio, payload
      ) VALUES (
        v_agend_id, v_tel_norm, 'IN', v_msg,
        'recebida', 'recebido', v_meta
      ) RETURNING id INTO v_msg_id;
    END;
  END IF;

  BEGIN
    INSERT INTO public.crm_audit_log (agendamento_id, acao, status_novo, detalhes)
    VALUES (
      v_agend_id,
      CASE WHEN v_criado THEN 'lead_ingest_n8n' ELSE 'lead_reaproveitado_n8n' END,
      coalesce(payload->>'status_crm','NOVO LEAD'),
      jsonb_build_object('payload', payload)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'agendamento_id', v_agend_id,
    'mensagem_id',    v_msg_id,
    'criado',         v_criado,
    'criado_em',      now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.crm_ingest_lead(jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.crm_ingest_lead(jsonb) TO service_role;


-- =====================================================================
-- [3] WEBHOOKS REVERSOS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.crm_webhook_endpoints (
  event       text PRIMARY KEY,
  url         text NOT NULL,
  secret      text,
  active      boolean NOT NULL DEFAULT true,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_webhook_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cwe_admin_all ON public.crm_webhook_endpoints;
CREATE POLICY cwe_admin_all ON public.crm_webhook_endpoints
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP TRIGGER IF EXISTS trg_cwe_updated ON public.crm_webhook_endpoints;
CREATE TRIGGER trg_cwe_updated
BEFORE UPDATE ON public.crm_webhook_endpoints
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE OR REPLACE FUNCTION public.crm_emit_event(p_event text, p_body jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_sec text;
  v_req bigint;
BEGIN
  SELECT url, secret INTO v_url, v_sec
    FROM public.crm_webhook_endpoints
   WHERE event = p_event AND active = true;

  IF v_url IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT net.http_post(
           url     := v_url,
           body    := p_body,
           headers := jsonb_build_object(
                        'Content-Type','application/json',
                        'X-Webhook-Event', p_event,
                        'X-Webhook-Secret', coalesce(v_sec,'')
                      ),
           timeout_milliseconds := 5000
         ) INTO v_req;

  RETURN v_req;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_emit_event(text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.crm_emit_event(text, jsonb) TO service_role;


-- =====================================================================
-- [4] TRIGGERS REVERSOS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trg_agendamento_novo_lead_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_sandbox IS TRUE THEN
    RETURN NEW;
  END IF;
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  PERFORM public.crm_emit_event(
    'lead.created',
    jsonb_build_object(
      'agendamento_id',   NEW.id,
      'nome',             NEW.nome_completo,
      'telefone',         NEW.telefone_whatsapp,
      'email',            NEW.email,
      'tipo_atendimento', NEW.tipo_atendimento,
      'local',            NEW.local_atendimento,
      'convenio',         NEW.convenio,
      'data_agendamento', NEW.data_agendamento,
      'hora_agendamento', NEW.hora_agendamento,
      'origem',           NEW.origem,
      'utm_source',       NEW.utm_source,
      'utm_campaign',     NEW.utm_campaign,
      'fbclid',           NEW.fbclid,
      'gclid',            NEW.gclid,
      'created_at',       NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agendamento_novo_lead ON public.agendamentos;
CREATE TRIGGER trg_agendamento_novo_lead
AFTER INSERT ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_agendamento_novo_lead_fn();


CREATE OR REPLACE FUNCTION public.trg_agendamento_needs_human_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_emit boolean := false;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  IF NEW.status_crm IS DISTINCT FROM OLD.status_crm
     AND NEW.status_crm ILIKE '%humano%' THEN
    v_should_emit := true;
  END IF;

  IF NEW.bot_pausado_ate IS NOT NULL
     AND OLD.bot_pausado_ate IS NULL THEN
    v_should_emit := true;
  END IF;

  IF v_should_emit THEN
    PERFORM public.crm_emit_event(
      'paciente.needs_human',
      jsonb_build_object(
        'agendamento_id', NEW.id,
        'nome',           NEW.nome_completo,
        'telefone',       NEW.telefone_whatsapp,
        'status_crm',     NEW.status_crm,
        'motivo_pausa',   NEW.bot_pausa_motivo,
        'pausado_ate',    NEW.bot_pausado_ate,
        'updated_at',     NEW.updated_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agendamento_needs_human ON public.agendamentos;
CREATE TRIGGER trg_agendamento_needs_human
AFTER UPDATE OF status_crm, bot_pausado_ate ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_agendamento_needs_human_fn();


-- =====================================================================
-- [5] LEMBRETE D-1
-- =====================================================================
CREATE OR REPLACE FUNCTION public.crm_disparar_lembretes_d1()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  c integer := 0;
BEGIN
  FOR r IN
    SELECT id, nome_completo, telefone_whatsapp,
           data_agendamento, hora_agendamento,
           local_atendimento, tipo_atendimento, convenio
      FROM public.agendamentos
     WHERE is_sandbox = false
       AND status_crm <> 'cancelado'
       AND data_agendamento = (current_date + interval '1 day')::date
       AND coalesce(confirmation_status,'nao_enviado') IN ('nao_enviado','falha_envio')
  LOOP
    PERFORM public.crm_emit_event(
      'agendamento.lembrete_d1',
      jsonb_build_object(
        'agendamento_id', r.id,
        'nome',           r.nome_completo,
        'telefone',       r.telefone_whatsapp,
        'data',           r.data_agendamento,
        'hora',           r.hora_agendamento,
        'local',          r.local_atendimento,
        'tipo',           r.tipo_atendimento,
        'convenio',       r.convenio
      )
    );
    UPDATE public.agendamentos
       SET confirmation_status = 'enviado',
           confirmation_sent_at = now(),
           confirmation_channel = 'whatsapp'
     WHERE id = r.id;
    c := c + 1;
  END LOOP;
  RETURN c;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_disparar_lembretes_d1() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.crm_disparar_lembretes_d1() TO service_role;

COMMIT;