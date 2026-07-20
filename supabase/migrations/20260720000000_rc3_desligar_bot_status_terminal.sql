-- RC3 — Desliga o bot automaticamente quando o card entra em status terminal.
--
-- Problema: há vários pontos de escrita de status (atualizar-status-crm via n8n,
-- cancelar-agendamento, drag-and-drop, migrar-atendidos, sync do Google Calendar).
-- Nenhum deles zera bot_ativo, então cards ATENDIDO/CANCELADO ficam com o bot ligado
-- e correm risco de receber reengajamento/lembrete. (60 cards nesse estado no snapshot.)
--
-- Solução central: um trigger BEFORE no próprio agendamentos garante o invariante
-- "status terminal => bot_ativo = false", independente de quem gravou.
--
-- Direção segura: este trigger só DESLIGA o bot. Nunca dispara mensagem.

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

-- Dispara ao inserir um card já terminal OU quando status_crm/status_funil mudam.
-- NÃO observa bot_ativo: reativação manual de um card terminal continua permitida
-- (override consciente do admin via reativar_bot_agendamento).
DROP TRIGGER IF EXISTS trg_desligar_bot_terminal ON public.agendamentos;
CREATE TRIGGER trg_desligar_bot_terminal
  BEFORE INSERT OR UPDATE OF status_crm, status_funil ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.desligar_bot_em_status_terminal();

-- Backfill único: cards que HOJE estão terminais mas com o bot ainda ligado.
UPDATE public.agendamentos
SET bot_ativo = false,
    updated_at = now()
WHERE bot_ativo = true
  AND (
    lower(coalesce(status_crm, '')) IN ('atendido', 'concluido', 'cancelado')
    OR coalesce(status_funil, '') IN ('finalizado', 'atendido', 'concluido', 'cancelado', 'compareceu', 'faltou')
  );
