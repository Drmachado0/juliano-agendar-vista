-- ============================================================================
-- APLICAR EM PRODUÇÃO (cnpifhaszbonwlqruwnn) — RC3 + View de atenção
-- ============================================================================
-- Cole este bloco inteiro no SQL Editor do Supabase/Lovable e rode UMA vez.
-- É idempotente (pode rodar de novo sem efeito colateral) e NÃO envia nenhuma
-- mensagem de WhatsApp. Já foi validado num clone do banco real.
--
-- O que faz:
--   [RC3] trigger central "status terminal => bot_ativo = false" + backfill
--         dos cards ATENDIDO/CANCELADO que hoje estão com o bot ligado.
--   [RC1] view read-only vw_crm_leads_atencao, que alimenta o botão
--         "Atenção (N)" no board.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- [RC3] Desliga o bot quando o card entra em status terminal
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.desligar_bot_em_status_terminal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF (
    lower(coalesce(NEW.status_crm, '')) IN ('atendido', 'concluido', 'cancelado')
    OR coalesce(NEW.status_funil, '') IN ('finalizado', 'atendido', 'concluido', 'cancelado', 'compareceu', 'faltou')
  ) AND NEW.bot_ativo IS DISTINCT FROM false THEN
    NEW.bot_ativo := false;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_desligar_bot_terminal ON public.agendamentos;
CREATE TRIGGER trg_desligar_bot_terminal
  BEFORE INSERT OR UPDATE OF status_crm, status_funil ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.desligar_bot_em_status_terminal();

WITH flipped AS (
  UPDATE public.agendamentos
  SET bot_ativo = false, updated_at = now()
  WHERE bot_ativo = true
    AND (
      lower(coalesce(status_crm, '')) IN ('atendido', 'concluido', 'cancelado')
      OR coalesce(status_funil, '') IN ('finalizado', 'atendido', 'concluido', 'cancelado', 'compareceu', 'faltou')
    )
  RETURNING 1
)
SELECT count(*) AS rc3_cards_desligados_no_backfill FROM flipped;

-- ----------------------------------------------------------------------------
-- [RC1] View de leads que precisam de atenção humana (somente leitura)
-- ----------------------------------------------------------------------------
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
    a.id AS agendamento_id, a.nome_completo AS nome, a.telefone_whatsapp AS telefone,
    a.status_crm, a.status_funil, a.bot_ativo, a.bot_pausado_ate, a.origem, a.created_at,
    m.ultima_in_at, m.ultima_out_at, COALESCE(m.out_boas_vindas, 0) AS out_boas_vindas,
    (lower(coalesce(a.status_crm, '')) IN ('atendido','concluido','cancelado')
     OR coalesce(a.status_funil, '') IN ('finalizado','atendido','concluido','cancelado','compareceu','faltou')) AS eh_terminal
  FROM public.agendamentos a
  LEFT JOIN msg m ON m.agendamento_id = a.id
  WHERE coalesce(a.is_sandbox, false) = false
)
SELECT
  agendamento_id, nome, telefone, status_crm, status_funil, bot_ativo, bot_pausado_ate, origem, created_at,
  ultima_in_at, ultima_out_at,
  CASE WHEN (status_crm = 'NOVO LEAD' OR status_funil = 'lead') AND out_boas_vindas = 0
       THEN 'lead_sem_welcome' ELSE 'inbound_sem_resposta' END AS categoria,
  round(extract(epoch FROM (now() - created_at)) / 3600.0, 1) AS horas_desde_criacao,
  round(extract(epoch FROM (now() - ultima_in_at)) / 3600.0, 1) AS horas_desde_ultima_in
FROM base
WHERE eh_terminal = false
  AND (((status_crm = 'NOVO LEAD' OR status_funil = 'lead') AND out_boas_vindas = 0)
       OR (ultima_in_at IS NOT NULL AND (ultima_out_at IS NULL OR ultima_in_at > ultima_out_at)))
ORDER BY COALESCE(ultima_in_at, created_at) ASC;

COMMENT ON VIEW public.vw_crm_leads_atencao IS
  'Leads que precisam de atenção humana (sem welcome ou com mensagem do paciente sem resposta). Somente leitura.';

GRANT SELECT ON public.vw_crm_leads_atencao TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Conferência pós-aplicação (deve retornar terminal_com_bot_ligado = 0):
-- ----------------------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE bot_ativo AND (lower(coalesce(status_crm,'')) IN ('atendido','concluido','cancelado')
                    OR coalesce(status_funil,'') IN ('finalizado','atendido','concluido','cancelado','compareceu','faltou'))) AS terminal_com_bot_ligado,
  (SELECT count(*) FROM public.vw_crm_leads_atencao) AS leads_precisando_atencao
FROM public.agendamentos
WHERE coalesce(is_sandbox,false) = false;
