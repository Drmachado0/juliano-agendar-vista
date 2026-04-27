-- 1. Add sandbox fields
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS is_sandbox boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sandbox_reason text;

CREATE INDEX IF NOT EXISTS idx_agendamentos_is_sandbox
  ON public.agendamentos (is_sandbox)
  WHERE is_sandbox = true;

-- 2. RPC to toggle sandbox (admin-only) with audit log
CREATE OR REPLACE FUNCTION public.set_agendamento_sandbox(
  p_agendamento_id uuid,
  p_is_sandbox boolean,
  p_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT is_sandbox INTO v_old
  FROM public.agendamentos
  WHERE id = p_agendamento_id;

  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Agendamento not found';
  END IF;

  UPDATE public.agendamentos
  SET is_sandbox = p_is_sandbox,
      sandbox_reason = CASE WHEN p_is_sandbox THEN p_reason ELSE NULL END,
      updated_at = now()
  WHERE id = p_agendamento_id;

  PERFORM public.registrar_crm_audit(
    p_agendamento_id,
    'sandbox_toggle',
    NULL,
    NULL,
    jsonb_build_object(
      'is_sandbox', p_is_sandbox,
      'previous', v_old,
      'reason', p_reason
    )
  );
END;
$$;