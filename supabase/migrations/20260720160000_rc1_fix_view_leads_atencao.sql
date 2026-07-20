-- RC1 fix — a view vw_crm_leads_atencao contava "lead_sem_welcome" pela ausência
-- da mensagem tagueada 'boas_vindas'. Isso inflava o contador "Atenção" com leads
-- que já estão EM CONVERSA (entraram via WhatsApp com status_funil 'novo'/'em_conversa'
-- e receberam respostas, só não a boas_vindas tagueada). No prod isso mostrava 20
-- quando o actionable real eram 2.
--
-- Correção: "lead sem contato" = ZERO outbound de qualquer tipo (mudo mesmo).
-- Categorias mantidas ('inbound_sem_resposta' / 'lead_sem_welcome') para não quebrar
-- o frontend (LeadsAtencaoDrawer / useCrmLeadsAtencao).

CREATE OR REPLACE VIEW public.vw_crm_leads_atencao AS
WITH msg AS (
  SELECT agendamento_id,
    max(created_at) FILTER (WHERE direcao = 'IN')  AS ultima_in_at,
    max(created_at) FILTER (WHERE direcao = 'OUT') AS ultima_out_at,
    count(*) FILTER (WHERE direcao = 'OUT') AS out_total
  FROM public.mensagens_whatsapp
  WHERE agendamento_id IS NOT NULL
  GROUP BY agendamento_id
),
base AS (
  SELECT
    a.id AS agendamento_id, a.nome_completo AS nome, a.telefone_whatsapp AS telefone,
    a.status_crm, a.status_funil, a.bot_ativo, a.bot_pausado_ate, a.origem, a.created_at,
    m.ultima_in_at, m.ultima_out_at, COALESCE(m.out_total, 0) AS out_total,
    (lower(coalesce(a.status_crm, '')) IN ('atendido', 'concluido', 'cancelado')
     OR coalesce(a.status_funil, '') IN ('finalizado', 'atendido', 'concluido', 'cancelado', 'compareceu', 'faltou')) AS eh_terminal
  FROM public.agendamentos a
  LEFT JOIN msg m ON m.agendamento_id = a.id
  WHERE coalesce(a.is_sandbox, false) = false
    AND coalesce(a.arquivado, false) = false
)
SELECT
  agendamento_id, nome, telefone, status_crm, status_funil, bot_ativo, bot_pausado_ate, origem, created_at,
  ultima_in_at, ultima_out_at,
  CASE WHEN ultima_in_at IS NOT NULL AND (ultima_out_at IS NULL OR ultima_in_at > ultima_out_at)
       THEN 'inbound_sem_resposta' ELSE 'lead_sem_welcome' END AS categoria,
  round(extract(epoch FROM (now() - created_at)) / 3600.0, 1) AS horas_desde_criacao,
  round(extract(epoch FROM (now() - ultima_in_at)) / 3600.0, 1) AS horas_desde_ultima_in
FROM base
WHERE eh_terminal = false
  AND (
    -- paciente escreveu e está esperando resposta
    (ultima_in_at IS NOT NULL AND (ultima_out_at IS NULL OR ultima_in_at > ultima_out_at))
    -- lead que nunca recebeu NENHUM contato de saída
    OR ((status_crm = 'NOVO LEAD' OR status_funil = 'lead') AND out_total = 0)
  )
ORDER BY COALESCE(ultima_in_at, created_at) ASC;

GRANT SELECT ON public.vw_crm_leads_atencao TO authenticated, service_role;
