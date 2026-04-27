-- 1) Tabela system_logs
CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL CHECK (level IN ('info','warn','error','critical')),
  category text NOT NULL,
  source text NOT NULL,
  message text NOT NULL,
  details jsonb,
  user_id uuid,
  user_email text,
  agendamento_id uuid,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level      ON public.system_logs (level);
CREATE INDEX IF NOT EXISTS idx_system_logs_category   ON public.system_logs (category);
CREATE INDEX IF NOT EXISTS idx_system_logs_source     ON public.system_logs (source);
CREATE INDEX IF NOT EXISTS idx_system_logs_agendamento ON public.system_logs (agendamento_id);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem SELECT. INSERT só via service_role (Edge Functions) ou RPC SECURITY DEFINER.
DROP POLICY IF EXISTS "Admins can view system logs" ON public.system_logs;
CREATE POLICY "Admins can view system logs"
ON public.system_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) RPC para registrar logs do frontend (admin actions)
CREATE OR REPLACE FUNCTION public.registrar_system_log(
  p_level text,
  p_category text,
  p_source text,
  p_message text,
  p_details jsonb DEFAULT NULL,
  p_agendamento_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF p_level NOT IN ('info','warn','error','critical') THEN
    RAISE EXCEPTION 'Invalid log level: %', p_level;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.system_logs (
    level, category, source, message, details,
    user_id, user_email, agendamento_id, request_id
  ) VALUES (
    p_level, p_category, p_source, p_message, p_details,
    auth.uid(), v_email, p_agendamento_id, p_request_id
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 3) RPC para listar logs com filtros
CREATE OR REPLACE FUNCTION public.listar_system_logs(
  p_search text DEFAULT NULL,
  p_level text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_data_inicio timestamptz DEFAULT NULL,
  p_data_fim timestamptz DEFAULT NULL,
  p_limit int DEFAULT 200
) RETURNS TABLE (
  id uuid,
  level text,
  category text,
  source text,
  message text,
  details jsonb,
  user_id uuid,
  user_email text,
  agendamento_id uuid,
  request_id text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    l.id, l.level, l.category, l.source, l.message, l.details,
    l.user_id, l.user_email, l.agendamento_id, l.request_id, l.created_at
  FROM public.system_logs l
  WHERE (p_level IS NULL OR l.level = p_level)
    AND (p_category IS NULL OR l.category = p_category)
    AND (p_source IS NULL OR l.source = p_source)
    AND (p_user_id IS NULL OR l.user_id = p_user_id)
    AND (p_data_inicio IS NULL OR l.created_at >= p_data_inicio)
    AND (p_data_fim IS NULL OR l.created_at <= p_data_fim)
    AND (
      p_search IS NULL OR p_search = '' OR (
        l.message ILIKE '%' || p_search || '%'
        OR l.source ILIKE '%' || p_search || '%'
        OR COALESCE(l.user_email, '') ILIKE '%' || p_search || '%'
      )
    )
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
END;
$$;

-- 4) Habilitar Realtime
ALTER TABLE public.system_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_logs;