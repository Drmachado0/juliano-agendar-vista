-- =====================================================================
-- LEMBRETES ANUAIS — FASE 1
-- Base auditável + lock anti-duplicidade para automação segura
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabela configuracoes_envio (singleton)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracoes_envio (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  limite_sessao integer NOT NULL DEFAULT 40,
  limite_diario integer NOT NULL DEFAULT 100,
  janela_inicio time NOT NULL DEFAULT '09:00',
  janela_fim time NOT NULL DEFAULT '18:00',
  status_global text NOT NULL DEFAULT 'pausado'
    CHECK (status_global IN ('ativo', 'pausado', 'bloqueado')),
  motivo_bloqueio text,
  blackout_dates date[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Validation trigger (não usar CHECK para flexibilidade futura)
CREATE OR REPLACE FUNCTION public.validar_configuracoes_envio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.janela_inicio >= NEW.janela_fim THEN
    RAISE EXCEPTION 'janela_inicio (%) deve ser menor que janela_fim (%)',
      NEW.janela_inicio, NEW.janela_fim;
  END IF;
  IF NEW.limite_sessao <= 0 THEN
    RAISE EXCEPTION 'limite_sessao deve ser maior que zero';
  END IF;
  IF NEW.limite_diario <= 0 THEN
    RAISE EXCEPTION 'limite_diario deve ser maior que zero';
  END IF;
  IF NEW.status_global = 'bloqueado'
     AND (NEW.motivo_bloqueio IS NULL OR length(trim(NEW.motivo_bloqueio)) = 0) THEN
    RAISE EXCEPTION 'motivo_bloqueio é obrigatório quando status_global = bloqueado';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_configuracoes_envio ON public.configuracoes_envio;
CREATE TRIGGER trg_validar_configuracoes_envio
  BEFORE INSERT OR UPDATE ON public.configuracoes_envio
  FOR EACH ROW EXECUTE FUNCTION public.validar_configuracoes_envio();

-- Seed singleton (status pausado por segurança)
INSERT INTO public.configuracoes_envio (id, status_global)
VALUES (true, 'pausado')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.configuracoes_envio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage configuracoes_envio"
  ON public.configuracoes_envio
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------
-- 2) Tabela logs_envio_lembrete
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logs_envio_lembrete (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  agente text NOT NULL CHECK (agente IN ('manual', 'lembretes-runner', 'cron')),
  status text NOT NULL CHECK (status IN ('sucesso', 'falha', 'bloqueado', 'ignorado')),
  motivo text,
  telefone text,
  nome text,
  mensagem_renderizada text,
  lembrete_id uuid,
  campanha_id uuid,
  remessa_id uuid,
  paciente_campanha_id uuid,
  latencia_ms integer,
  request_id text,
  payload jsonb
);

CREATE INDEX IF NOT EXISTS idx_logs_envio_lembrete_created_at
  ON public.logs_envio_lembrete (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_envio_lembrete_status_created
  ON public.logs_envio_lembrete (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_envio_lembrete_agente_created
  ON public.logs_envio_lembrete (agente, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_envio_lembrete_campanha
  ON public.logs_envio_lembrete (campanha_id);
CREATE INDEX IF NOT EXISTS idx_logs_envio_lembrete_request
  ON public.logs_envio_lembrete (request_id);

ALTER TABLE public.logs_envio_lembrete ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage logs_envio_lembrete"
  ON public.logs_envio_lembrete
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------
-- 3) Lock anti-duplicidade em lembretes_campanha_pacientes
-- ---------------------------------------------------------------------
ALTER TABLE public.lembretes_campanha_pacientes
  ADD COLUMN IF NOT EXISTS processado_por text,
  ADD COLUMN IF NOT EXISTS lock_until timestamptz,
  ADD COLUMN IF NOT EXISTS lock_token uuid;

CREATE INDEX IF NOT EXISTS idx_lembretes_camp_pac_lock
  ON public.lembretes_campanha_pacientes (lock_until)
  WHERE lock_until IS NOT NULL;

-- ---------------------------------------------------------------------
-- 4) Funções de claim / release
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_paciente_campanha(
  p_paciente_id uuid,
  p_processador text,
  p_ttl_seconds integer DEFAULT 120
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid;
BEGIN
  IF p_ttl_seconds IS NULL OR p_ttl_seconds <= 0 OR p_ttl_seconds > 3600 THEN
    p_ttl_seconds := 120;
  END IF;

  UPDATE public.lembretes_campanha_pacientes
  SET lock_token = gen_random_uuid(),
      lock_until = now() + make_interval(secs => p_ttl_seconds),
      processado_por = p_processador,
      updated_at = now()
  WHERE id = p_paciente_id
    AND status = 'pendente'
    AND (lock_until IS NULL OR lock_until < now())
  RETURNING lock_token INTO v_token;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_paciente_campanha(
  p_paciente_id uuid,
  p_lock_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.lembretes_campanha_pacientes
  SET lock_token = NULL,
      lock_until = NULL,
      processado_por = NULL,
      updated_at = now()
  WHERE id = p_paciente_id
    AND lock_token = p_lock_token;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

-- ---------------------------------------------------------------------
-- 5) View vw_status_campanha_atual
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_status_campanha_atual AS
WITH cfg AS (
  SELECT * FROM public.configuracoes_envio WHERE id = true
),
campanha_mes AS (
  SELECT *
  FROM public.lembretes_campanhas
  WHERE ano_referencia = EXTRACT(YEAR FROM CURRENT_DATE)::int
    AND mes_referencia = EXTRACT(MONTH FROM CURRENT_DATE)::int
  ORDER BY created_at DESC
  LIMIT 1
),
proxima_remessa AS (
  SELECT r.*
  FROM public.lembretes_campanha_remessas r
  JOIN campanha_mes c ON c.id = r.campanha_id
  WHERE r.data_programada >= CURRENT_DATE
    AND r.status IN ('agendada', 'em_andamento')
  ORDER BY r.data_programada ASC
  LIMIT 1
),
totais_pacientes AS (
  SELECT
    COUNT(*) FILTER (WHERE p.status = 'pendente')   AS pendentes,
    COUNT(*) FILTER (WHERE p.status = 'enviado')    AS enviados,
    COUNT(*) FILTER (WHERE p.status = 'falha')      AS falhas,
    COUNT(*) FILTER (WHERE p.status = 'ignorado')   AS ignorados
  FROM public.lembretes_campanha_pacientes p
  JOIN campanha_mes c ON c.id = p.campanha_id
),
logs_hoje AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'sucesso')  AS enviados_hoje,
    COUNT(*) FILTER (WHERE status = 'falha')    AS falhas_hoje,
    COUNT(*) FILTER (WHERE status = 'bloqueado') AS bloqueados_hoje,
    COUNT(*) FILTER (WHERE status = 'ignorado') AS ignorados_hoje,
    MAX(created_at) AS ultimo_envio_at
  FROM public.logs_envio_lembrete
  WHERE created_at >= date_trunc('day', now())
)
SELECT
  (SELECT id FROM campanha_mes)                AS campanha_id,
  (SELECT ano_referencia FROM campanha_mes)    AS ano_referencia,
  (SELECT mes_referencia FROM campanha_mes)    AS mes_referencia,
  (SELECT status FROM campanha_mes)            AS campanha_status,
  (SELECT total_elegivel FROM campanha_mes)    AS total_elegivel,
  (SELECT total_enviados FROM campanha_mes)    AS total_enviados,
  (SELECT total_falhas FROM campanha_mes)      AS total_falhas,
  (SELECT total_ignorados FROM campanha_mes)   AS total_ignorados,
  (SELECT id FROM proxima_remessa)             AS proxima_remessa_id,
  (SELECT numero_remessa FROM proxima_remessa) AS proxima_remessa_numero,
  (SELECT data_programada FROM proxima_remessa) AS proxima_remessa_data,
  (SELECT status FROM proxima_remessa)         AS proxima_remessa_status,
  COALESCE((SELECT pendentes FROM totais_pacientes), 0)  AS pacientes_pendentes,
  COALESCE((SELECT enviados FROM totais_pacientes), 0)   AS pacientes_enviados,
  COALESCE((SELECT falhas FROM totais_pacientes), 0)     AS pacientes_falhas,
  COALESCE((SELECT ignorados FROM totais_pacientes), 0)  AS pacientes_ignorados,
  COALESCE((SELECT enviados_hoje FROM logs_hoje), 0)    AS enviados_hoje,
  COALESCE((SELECT falhas_hoje FROM logs_hoje), 0)      AS falhas_hoje,
  COALESCE((SELECT bloqueados_hoje FROM logs_hoje), 0)  AS bloqueados_hoje,
  COALESCE((SELECT ignorados_hoje FROM logs_hoje), 0)   AS ignorados_hoje,
  (SELECT ultimo_envio_at FROM logs_hoje)               AS ultimo_envio_at,
  (SELECT status_global FROM cfg)        AS status_global,
  (SELECT motivo_bloqueio FROM cfg)      AS motivo_bloqueio,
  (SELECT limite_sessao FROM cfg)        AS limite_sessao,
  (SELECT limite_diario FROM cfg)        AS limite_diario,
  (SELECT janela_inicio FROM cfg)        AS janela_inicio,
  (SELECT janela_fim FROM cfg)           AS janela_fim,
  (SELECT blackout_dates FROM cfg)       AS blackout_dates,
  CURRENT_DATE                           AS data_atual,
  now()                                  AS gerado_em;