-- rev-3 2026-07-13 — fail-closed em agendamentos + limpeza de índices.
-- Idempotente. Não altera cards ambíguos. Aborta com diagnóstico em colisão real.

-- 1) Remove o índice antigo (predicado 'cancelado' minúsculo) antes do backfill,
--    pois ele considera cards CANCELADO uppercase como ativos e bloqueia o UPDATE.
DROP INDEX IF EXISTS public.uniq_agendamento_slot_ativo;

-- 2) Backfill de clinica_id para IDs canônicos.
DO $backfill$
DECLARE
  v_clinicor uuid := '657e4784-e292-45c6-a033-40f3d115f984';
  v_hgp      uuid := '5f2f3bcb-5945-4220-912a-4d7c79b9b056';
  v_iob      uuid := 'f72d4685-7e91-4b27-b4e6-8c47db742bef';
  v_vitria   uuid := 'dee8244b-a4f0-492a-aa59-89cfb8848463';
BEGIN
  UPDATE public.agendamentos SET clinica_id = v_clinicor
   WHERE clinica_id IS NULL AND data_agendamento IS NOT NULL
     AND hora_agendamento IS NOT NULL
     AND lower(coalesce(local_atendimento, '')) LIKE '%clinicor%';

  UPDATE public.agendamentos SET clinica_id = v_hgp
   WHERE clinica_id IS NULL AND data_agendamento IS NOT NULL
     AND hora_agendamento IS NOT NULL
     AND (lower(coalesce(local_atendimento, '')) LIKE '%hgp%'
          OR lower(coalesce(local_atendimento, '')) LIKE '%hospital geral%');

  UPDATE public.agendamentos SET clinica_id = v_iob
   WHERE clinica_id IS NULL AND data_agendamento IS NOT NULL
     AND hora_agendamento IS NOT NULL
     AND lower(coalesce(local_atendimento, '')) LIKE '%iob%';

  UPDATE public.agendamentos SET clinica_id = v_vitria
   WHERE clinica_id IS NULL AND data_agendamento IS NOT NULL
     AND hora_agendamento IS NOT NULL
     AND lower(coalesce(local_atendimento, '')) LIKE '%vitria%';
END
$backfill$;

-- 3) Pré-checagem antes de recriar o UNIQUE.
DO $check$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM (
    SELECT clinica_id, data_agendamento, hora_agendamento
      FROM public.agendamentos
     WHERE clinica_id IS NOT NULL
       AND data_agendamento IS NOT NULL
       AND hora_agendamento IS NOT NULL
       AND coalesce(is_sandbox, false) = false
       AND upper(coalesce(status_crm, '')) NOT IN
           ('CANCELADO','ATENDIDO','COMPARECEU','FALTOU','EXCLUIDO')
       AND lower(coalesce(status_funil, '')) NOT IN
           ('cancelado','atendido','compareceu','faltou','excluido')
     GROUP BY 1,2,3 HAVING count(*) > 1
  ) x;
  IF v_n > 0 THEN
    RAISE EXCEPTION
      'colisao_slot_ativo: % slot(s) com >1 agendamento ativo apos normalizacao. Resolver manualmente antes de recriar o unique.',
      v_n;
  END IF;
END
$check$;

-- 4) Recria o UNIQUE com predicado case-insensitive e terminais reais.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_agendamento_slot_ativo
  ON public.agendamentos (clinica_id, data_agendamento, hora_agendamento)
  WHERE clinica_id IS NOT NULL
    AND data_agendamento IS NOT NULL
    AND hora_agendamento IS NOT NULL
    AND coalesce(is_sandbox, false) = false
    AND upper(coalesce(status_crm, '')) NOT IN
        ('CANCELADO','ATENDIDO','COMPARECEU','FALTOU','EXCLUIDO')
    AND lower(coalesce(status_funil, '')) NOT IN
        ('cancelado','atendido','compareceu','faltou','excluido');

-- 5) Guard: data+hora exigem clinica_id (leads sem data continuam permitidos).
CREATE OR REPLACE FUNCTION public.agendamentos_require_clinica_when_scheduled()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  IF NEW.data_agendamento IS NOT NULL
     AND NEW.hora_agendamento IS NOT NULL
     AND NEW.clinica_id IS NULL THEN
    RAISE EXCEPTION 'clinica_id_obrigatorio_quando_data_hora_definidas'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_agendamentos_require_clinica ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_require_clinica
  BEFORE INSERT OR UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.agendamentos_require_clinica_when_scheduled();

-- 6) Índice duplicado em mensagens_whatsapp.mensagem_externa_id.
DROP INDEX IF EXISTS public.uq_mensagens_whatsapp_externa_id;
