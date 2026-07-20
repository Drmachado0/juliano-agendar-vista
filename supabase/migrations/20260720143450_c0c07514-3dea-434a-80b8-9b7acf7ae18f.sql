
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em timestamptz,
  ADD COLUMN IF NOT EXISTS arquivado_motivo text;

CREATE INDEX IF NOT EXISTS idx_agendamentos_arquivado_false
  ON public.agendamentos (arquivado)
  WHERE arquivado = false;

CREATE OR REPLACE FUNCTION public.arquivar_agendamentos_antigos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.agendamentos a
    SET arquivado = true,
        arquivado_em = now(),
        arquivado_motivo = 'auto:7d_pos_atendimento',
        bot_ativo = false
    WHERE a.arquivado = false
      AND (
        (a.status_crm = ANY (ARRAY['ATENDIDO','atendido','CONCLUIDO','concluido']))
        OR (a.status_funil = ANY (ARRAY['finalizado','atendido','compareceu']))
      )
      AND COALESCE(a.data_agendamento, a.updated_at::date) < (CURRENT_DATE - INTERVAL '7 days')
    RETURNING 1
  )
  SELECT COUNT(*)::int INTO v_count FROM upd;

  INSERT INTO public.system_logs (category, level, source, message, details)
  VALUES (
    'arquivamento_agendamentos', 'info', 'cron',
    'Arquivamento automático executado',
    jsonb_build_object('total_arquivados', v_count, 'executed_at', now())
  );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.arquivar_agendamentos_antigos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.arquivar_agendamentos_antigos() TO service_role;

DROP VIEW IF EXISTS public.vw_crm_kanban;

CREATE VIEW public.vw_crm_kanban
WITH (security_invoker=on) AS
  WITH ultima_msg AS (
    SELECT DISTINCT ON (m.agendamento_id) m.agendamento_id,
      m.conteudo AS ultima_msg,
      m.direcao AS ultima_msg_direcao,
      m.created_at AS ultima_msg_at,
      m.lida AS ultima_msg_lida
    FROM public.mensagens_whatsapp m
    WHERE m.agendamento_id IS NOT NULL
    ORDER BY m.agendamento_id, m.created_at DESC
  ), contagem_msg AS (
    SELECT m.agendamento_id, count(*) AS total_mensagens
    FROM public.mensagens_whatsapp m
    WHERE m.agendamento_id IS NOT NULL
    GROUP BY m.agendamento_id
  )
  SELECT a.id AS agendamento_id, a.nome_completo AS nome, a.telefone_whatsapp AS telefone,
    a.email, a.data_nascimento, a.tipo_atendimento, a.detalhe_exame_ou_cirurgia,
    a.local_atendimento AS unidade, a.convenio, a.convenio_outro,
    a.data_agendamento, a.hora_agendamento, a.status_crm, a.status_funil, a.origem,
    a.confirmation_status, a.confirmacao_enviada, a.bot_ativo, a.bot_pausado_ate,
    a.is_sandbox, a.sandbox_reason,
    a.utm_source, a.utm_medium, a.utm_campaign, a.utm_term, a.utm_content,
    a.gclid, a.fbclid, a.fbp, a.fbc, a.landing_page, a.referrer,
    a.clinica_id, a.profissional_id, a.servico_id,
    c.nome AS clinica_nome, s.nome AS servico_nome, p.nome AS profissional_nome,
    CASE
      WHEN (a.status_crm = ANY (ARRAY['ATENDIDO','atendido','CONCLUIDO','concluido']))
        OR (a.status_funil = ANY (ARRAY['finalizado','atendido'])) THEN 'ATENDIDO'
      WHEN a.status_crm ~~* '%humano%' OR (a.bot_pausado_ate IS NOT NULL AND a.bot_pausado_ate > now()) THEN 'PRECISA DE HUMANO'
      WHEN a.status_crm = 'NOVO LEAD' THEN 'NOVO LEAD'
      ELSE a.status_crm
    END AS coluna_kanban,
    a.created_at, a.updated_at,
    um.ultima_msg, um.ultima_msg_direcao, um.ultima_msg_at, um.ultima_msg_lida,
    COALESCE(cm.total_mensagens, 0::bigint) AS total_mensagens
  FROM public.agendamentos a
  LEFT JOIN public.clinicas c ON c.id = a.clinica_id
  LEFT JOIN public.servicos s ON s.id = a.servico_id
  LEFT JOIN public.profissionais p ON p.id = a.profissional_id
  LEFT JOIN ultima_msg um ON um.agendamento_id = a.id
  LEFT JOIN contagem_msg cm ON cm.agendamento_id = a.id
  WHERE a.is_sandbox = false
    AND a.arquivado = false
    AND NOT (
      (
        (a.status_crm = ANY (ARRAY['ATENDIDO','atendido','CONCLUIDO','concluido']))
        OR (a.status_funil = ANY (ARRAY['finalizado','atendido','compareceu']))
      )
      AND COALESCE(a.data_agendamento, a.updated_at::date) < (CURRENT_DATE - INTERVAL '7 days')
    );

GRANT SELECT ON public.vw_crm_kanban TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'arquivar-agendamentos-diario';
    PERFORM cron.schedule(
      'arquivar-agendamentos-diario',
      '15 3 * * *',
      $cmd$SELECT public.arquivar_agendamentos_antigos();$cmd$
    );
  END IF;
END $$;

SELECT public.arquivar_agendamentos_antigos();
