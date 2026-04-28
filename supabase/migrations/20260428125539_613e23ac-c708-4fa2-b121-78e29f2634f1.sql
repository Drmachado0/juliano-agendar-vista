-- 1. Colunas em agendamentos
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS bot_pausado_ate timestamptz,
  ADD COLUMN IF NOT EXISTS bot_pausado_por uuid,
  ADD COLUMN IF NOT EXISTS bot_pausa_motivo text;

CREATE INDEX IF NOT EXISTS idx_agendamentos_bot_pausado_ate
  ON public.agendamentos (bot_pausado_ate)
  WHERE bot_pausado_ate IS NOT NULL;

-- 2. Tabela bot_config (singleton)
CREATE TABLE IF NOT EXISTS public.bot_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  pausa_automatica_ativa boolean NOT NULL DEFAULT true,
  pausa_automatica_minutos integer NOT NULL DEFAULT 30 CHECK (pausa_automatica_minutos BETWEEN 1 AND 1440),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.bot_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.bot_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view bot_config" ON public.bot_config;
CREATE POLICY "Admins can view bot_config"
  ON public.bot_config FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update bot_config" ON public.bot_config;
CREATE POLICY "Admins can update bot_config"
  ON public.bot_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. RPC para pausar/reativar manualmente (UI)
CREATE OR REPLACE FUNCTION public.pausar_bot_agendamento(
  p_agendamento_id uuid,
  p_minutos integer DEFAULT NULL,
  p_motivo text DEFAULT 'manual'
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_minutos integer;
  v_ate timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF p_minutos IS NULL THEN
    SELECT pausa_automatica_minutos INTO v_minutos FROM public.bot_config WHERE id = true;
    v_minutos := COALESCE(v_minutos, 30);
  ELSE
    v_minutos := GREATEST(1, LEAST(p_minutos, 1440));
  END IF;

  v_ate := now() + make_interval(mins => v_minutos);

  UPDATE public.agendamentos
  SET bot_ativo = false,
      bot_pausado_ate = v_ate,
      bot_pausado_por = auth.uid(),
      bot_pausa_motivo = p_motivo,
      updated_at = now()
  WHERE id = p_agendamento_id;

  PERFORM public.registrar_crm_audit(
    p_agendamento_id,
    'bot_pausado_manual',
    NULL, NULL,
    jsonb_build_object('minutos', v_minutos, 'motivo', p_motivo, 'ate', v_ate)
  );

  RETURN v_ate;
END;
$$;

CREATE OR REPLACE FUNCTION public.reativar_bot_agendamento(p_agendamento_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  UPDATE public.agendamentos
  SET bot_ativo = true,
      bot_pausado_ate = NULL,
      bot_pausa_motivo = NULL,
      bot_pausado_por = NULL,
      updated_at = now()
  WHERE id = p_agendamento_id;

  PERFORM public.registrar_crm_audit(
    p_agendamento_id,
    'bot_reativado_manual',
    NULL, NULL,
    NULL
  );
END;
$$;

-- 4. Realtime na tabela agendamentos (já deve estar, garantindo idempotência)
ALTER TABLE public.agendamentos REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'agendamentos';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.agendamentos';
  END IF;
END $$;