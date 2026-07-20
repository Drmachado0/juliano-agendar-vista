-- RC1 (sem envio) — Visibilidade: expõe os leads que precisam de atenção humana,
-- para o board "gritar" quem está sem resposta em vez de o bot responder sozinho.
--
-- View READ-ONLY: não envia nenhuma mensagem, não altera nenhum card.
-- Categorias:
--   * lead_sem_welcome     -> lead em NOVO LEAD/funil 'lead' que nunca recebeu boas_vindas
--   * inbound_sem_resposta -> última mensagem foi do paciente (IN) e ninguém respondeu (OUT)
-- Ignora sandbox e cards terminais (atendido/cancelado/compareceu/faltou/etc).

CREATE OR REPLACE VIEW public.vw_crm_leads_atencao AS
WITH msg AS (
  SELECT
    agendamento_id,
    max(created_at) FILTER (WHERE direcao = 'IN')  AS ultima_in_at,
    max(created_at) FILTER (WHERE direcao = 'OUT') AS ultima_out_at,
    count(*) FILTER (WHERE direcao = 'OUT' AND tipo_mensagem = 'boas_vindas') AS out_boas_vindas
  FROM public.mensagens_whatsapp
  WHERE agendamento_id IS NOT NULL
  GROUP BY agendamento_id
),
base AS (
  SELECT
    a.id AS agendamento_id,
    a.nome_completo AS nome,
    a.telefone_whatsapp AS telefone,
    a.status_crm,
    a.status_funil,
    a.bot_ativo,
    a.bot_pausado_ate,
    a.origem,
    a.created_at,
    m.ultima_in_at,
    m.ultima_out_at,
    COALESCE(m.out_boas_vindas, 0) AS out_boas_vindas,
    (
      lower(coalesce(a.status_crm, '')) IN ('atendido', 'concluido', 'cancelado')
      OR coalesce(a.status_funil, '') IN ('finalizado', 'atendido', 'concluido', 'cancelado', 'compareceu', 'faltou')
    ) AS eh_terminal
  FROM public.agendamentos a
  LEFT JOIN msg m ON m.agendamento_id = a.id
  WHERE coalesce(a.is_sandbox, false) = false
)
SELECT
  agendamento_id,
  nome,
  telefone,
  status_crm,
  status_funil,
  bot_ativo,
  bot_pausado_ate,
  origem,
  created_at,
  ultima_in_at,
  ultima_out_at,
  CASE
    WHEN (status_crm = 'NOVO LEAD' OR status_funil = 'lead') AND out_boas_vindas = 0
      THEN 'lead_sem_welcome'
    ELSE 'inbound_sem_resposta'
  END AS categoria,
  round(extract(epoch FROM (now() - created_at)) / 3600.0, 1) AS horas_desde_criacao,
  round(extract(epoch FROM (now() - ultima_in_at)) / 3600.0, 1) AS horas_desde_ultima_in
FROM base
WHERE eh_terminal = false
  AND (
    ((status_crm = 'NOVO LEAD' OR status_funil = 'lead') AND out_boas_vindas = 0)
    OR (ultima_in_at IS NOT NULL AND (ultima_out_at IS NULL OR ultima_in_at > ultima_out_at))
  )
ORDER BY COALESCE(ultima_in_at, created_at) ASC;

COMMENT ON VIEW public.vw_crm_leads_atencao IS
  'Leads que precisam de atenção humana (sem welcome ou com mensagem do paciente sem resposta). Somente leitura.';

-- Mesma exposição das views vw_crm_kanban / vw_crm_kanban_all
GRANT SELECT ON public.vw_crm_leads_atencao TO authenticated, service_role;
