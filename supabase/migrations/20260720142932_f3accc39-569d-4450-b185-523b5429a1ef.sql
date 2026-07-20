CREATE OR REPLACE VIEW public.vw_crm_kanban AS
WITH ultima_msg AS (
  SELECT DISTINCT ON (mensagens_whatsapp.agendamento_id) mensagens_whatsapp.agendamento_id,
    mensagens_whatsapp.conteudo AS ultima_msg,
    mensagens_whatsapp.direcao AS ultima_msg_direcao,
    mensagens_whatsapp.created_at AS ultima_msg_at,
    mensagens_whatsapp.lida AS ultima_msg_lida
  FROM mensagens_whatsapp
  WHERE mensagens_whatsapp.agendamento_id IS NOT NULL
  ORDER BY mensagens_whatsapp.agendamento_id, mensagens_whatsapp.created_at DESC
), contagem_msg AS (
  SELECT mensagens_whatsapp.agendamento_id, count(*) AS total_mensagens
  FROM mensagens_whatsapp
  WHERE mensagens_whatsapp.agendamento_id IS NOT NULL
  GROUP BY mensagens_whatsapp.agendamento_id
)
SELECT a.id AS agendamento_id,
  a.nome_completo AS nome, a.telefone_whatsapp AS telefone, a.email, a.data_nascimento,
  a.tipo_atendimento, a.detalhe_exame_ou_cirurgia, a.local_atendimento AS unidade,
  a.convenio, a.convenio_outro, a.data_agendamento, a.hora_agendamento,
  a.status_crm, a.status_funil, a.origem, a.confirmation_status, a.confirmacao_enviada,
  a.bot_ativo, a.bot_pausado_ate, a.is_sandbox, a.sandbox_reason,
  a.utm_source, a.utm_medium, a.utm_campaign, a.utm_term, a.utm_content,
  a.gclid, a.fbclid, a.fbp, a.fbc, a.landing_page, a.referrer,
  a.clinica_id, a.profissional_id, a.servico_id,
  c.nome AS clinica_nome, s.nome AS servico_nome, pr.nome AS profissional_nome,
  cv.valor_consulta AS valor_convenio,
  COALESCE(cm.total_mensagens, 0::bigint) AS total_mensagens,
  um.ultima_msg, um.ultima_msg_direcao, um.ultima_msg_at, um.ultima_msg_lida,
  a.created_at, a.updated_at,
  CASE
    WHEN (a.status_crm = ANY (ARRAY['ATENDIDO'::text, 'atendido'::text, 'CONCLUIDO'::text, 'concluido'::text])) OR (a.status_funil = ANY (ARRAY['finalizado'::text, 'atendido'::text])) THEN 'ATENDIDO'::text
    WHEN (a.status_crm ~~* '%humano%'::text) OR ((a.bot_pausado_ate IS NOT NULL) AND (a.bot_pausado_ate > now())) THEN 'PRECISA DE HUMANO'::text
    WHEN a.status_crm = 'NOVO LEAD'::text THEN 'NOVO LEAD'::text
    WHEN a.data_agendamento IS NULL THEN 'AGUARDANDO'::text
    WHEN a.local_atendimento ~~* 'clinicor%'::text THEN 'CLINICOR'::text
    WHEN a.local_atendimento ~~* 'hgp%'::text THEN 'HGP'::text
    WHEN a.local_atendimento ~~* 'bel%m%'::text THEN 'BELÉM'::text
    ELSE 'AGUARDANDO'::text
  END AS coluna_kanban
FROM agendamentos a
  LEFT JOIN clinicas c ON c.id = a.clinica_id
  LEFT JOIN servicos s ON s.id = a.servico_id
  LEFT JOIN profissionais pr ON pr.id = a.profissional_id
  LEFT JOIN convenios cv ON cv.slug = lower(a.convenio)
  LEFT JOIN ultima_msg um ON um.agendamento_id = a.id
  LEFT JOIN contagem_msg cm ON cm.agendamento_id = a.id
WHERE a.is_sandbox = false
  AND NOT (
    (
      a.status_crm = ANY (ARRAY['ATENDIDO'::text, 'atendido'::text, 'CONCLUIDO'::text, 'concluido'::text])
      OR a.status_funil = ANY (ARRAY['finalizado'::text, 'atendido'::text, 'compareceu'::text])
    )
    AND COALESCE(a.data_agendamento, a.updated_at::date) < (CURRENT_DATE - INTERVAL '7 days')
  );