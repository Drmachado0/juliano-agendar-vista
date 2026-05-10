BEGIN;

DROP VIEW IF EXISTS public.vw_crm_kanban_all;
DROP VIEW IF EXISTS public.vw_crm_kanban;

CREATE VIEW public.vw_crm_kanban
WITH (security_invoker = true)
AS
WITH ultima_msg AS (
  SELECT DISTINCT ON (agendamento_id)
         agendamento_id, conteudo AS ultima_msg, direcao AS ultima_msg_direcao,
         created_at AS ultima_msg_at, lida AS ultima_msg_lida
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
  a.id AS agendamento_id,
  a.nome_completo AS nome,
  a.telefone_whatsapp AS telefone,
  a.email, a.data_nascimento,
  a.tipo_atendimento, a.detalhe_exame_ou_cirurgia,
  a.local_atendimento AS unidade,
  a.convenio, a.convenio_outro,
  a.data_agendamento, a.hora_agendamento,
  a.status_crm, a.status_funil, a.origem,
  a.confirmation_status, a.confirmacao_enviada,
  a.bot_ativo, a.bot_pausado_ate, a.is_sandbox, a.sandbox_reason,
  a.utm_source, a.utm_medium, a.utm_campaign, a.utm_term, a.utm_content,
  a.gclid, a.fbclid, a.fbp, a.fbc, a.landing_page, a.referrer,
  a.clinica_id, a.profissional_id, a.servico_id,
  c.nome  AS clinica_nome,
  s.nome  AS servico_nome,
  pr.nome AS profissional_nome,
  cv.valor_consulta AS valor_convenio,
  COALESCE(cm.total_mensagens, 0) AS total_mensagens,
  um.ultima_msg, um.ultima_msg_direcao, um.ultima_msg_at, um.ultima_msg_lida,
  a.created_at, a.updated_at,
  CASE
    WHEN a.status_crm IN ('ATENDIDO','atendido','CONCLUIDO','concluido')
         OR a.status_funil IN ('finalizado','atendido')
      THEN 'ATENDIDO'
    WHEN a.status_crm ILIKE '%humano%'
         OR (a.bot_pausado_ate IS NOT NULL AND a.bot_pausado_ate > now())
      THEN 'PRECISA DE HUMANO'
    WHEN a.status_crm = 'NOVO LEAD' THEN 'NOVO LEAD'
    WHEN a.data_agendamento IS NULL THEN 'AGUARDANDO'
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

CREATE VIEW public.vw_crm_kanban_all
WITH (security_invoker = true)
AS
WITH ultima_msg AS (
  SELECT DISTINCT ON (agendamento_id)
         agendamento_id, conteudo AS ultima_msg, direcao AS ultima_msg_direcao,
         created_at AS ultima_msg_at, lida AS ultima_msg_lida
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
  a.id AS agendamento_id,
  a.nome_completo AS nome,
  a.telefone_whatsapp AS telefone,
  a.email, a.data_nascimento,
  a.tipo_atendimento, a.detalhe_exame_ou_cirurgia,
  a.local_atendimento AS unidade,
  a.convenio, a.convenio_outro,
  a.data_agendamento, a.hora_agendamento,
  a.status_crm, a.status_funil, a.origem,
  a.confirmation_status, a.confirmacao_enviada,
  a.bot_ativo, a.bot_pausado_ate, a.is_sandbox, a.sandbox_reason,
  a.utm_source, a.utm_medium, a.utm_campaign, a.utm_term, a.utm_content,
  a.gclid, a.fbclid, a.fbp, a.fbc, a.landing_page, a.referrer,
  a.clinica_id, a.profissional_id, a.servico_id,
  c.nome  AS clinica_nome,
  s.nome  AS servico_nome,
  pr.nome AS profissional_nome,
  cv.valor_consulta AS valor_convenio,
  COALESCE(cm.total_mensagens, 0) AS total_mensagens,
  um.ultima_msg, um.ultima_msg_direcao, um.ultima_msg_at, um.ultima_msg_lida,
  a.created_at, a.updated_at,
  CASE
    WHEN a.status_crm IN ('ATENDIDO','atendido','CONCLUIDO','concluido')
         OR a.status_funil IN ('finalizado','atendido')
      THEN 'ATENDIDO'
    WHEN a.status_crm ILIKE '%humano%'
         OR (a.bot_pausado_ate IS NOT NULL AND a.bot_pausado_ate > now())
      THEN 'PRECISA DE HUMANO'
    WHEN a.status_crm = 'NOVO LEAD' THEN 'NOVO LEAD'
    WHEN a.data_agendamento IS NULL THEN 'AGUARDANDO'
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
LEFT JOIN contagem_msg          cm ON cm.agendamento_id = a.id;

GRANT SELECT ON public.vw_crm_kanban, public.vw_crm_kanban_all TO authenticated, service_role;

ALTER FUNCTION public.crm_ingest_lead(jsonb)              SET search_path = public, pg_temp;
ALTER FUNCTION public.crm_emit_event(text, jsonb)         SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.trg_agendamento_novo_lead_fn()      SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_agendamento_needs_human_fn()    SET search_path = public, pg_temp;
ALTER FUNCTION public.crm_disparar_lembretes_d1()         SET search_path = public, pg_temp;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_webhook_endpoints_event_key'
  ) THEN
    ALTER TABLE public.crm_webhook_endpoints
      ADD CONSTRAINT crm_webhook_endpoints_event_key UNIQUE (event);
  END IF;
END $$;

INSERT INTO public.crm_webhook_endpoints (event, url, secret, active, description)
VALUES
  ('lead.created',           '', '', false, 'Disparado quando um novo lead é criado em agendamentos (não-sandbox).'),
  ('paciente.needs_human',   '', '', false, 'Disparado quando status_crm vira "humano" ou bot é pausado manualmente.'),
  ('agendamento.lembrete_d1','', '', false, 'Disparado pelo cron diário (18h BRT) para confirmações D-1.')
ON CONFLICT (event) DO NOTHING;

COMMIT;