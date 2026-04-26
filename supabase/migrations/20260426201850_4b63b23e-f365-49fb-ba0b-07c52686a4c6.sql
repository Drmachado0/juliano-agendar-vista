-- Tabela de auditoria do CRM
CREATE TABLE public.crm_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  user_name text,
  acao text NOT NULL, -- 'status_change', 'reprocess_welcome', 'manual_whatsapp', 'automation_trigger'
  status_anterior text,
  status_novo text,
  detalhes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_audit_agendamento ON public.crm_audit_log(agendamento_id);
CREATE INDEX idx_crm_audit_user ON public.crm_audit_log(user_id);
CREATE INDEX idx_crm_audit_created ON public.crm_audit_log(created_at DESC);
CREATE INDEX idx_crm_audit_acao ON public.crm_audit_log(acao);

ALTER TABLE public.crm_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON public.crm_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert audit log"
  ON public.crm_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Helper RPC para registrar entradas (captura email do auth.users automaticamente)
CREATE OR REPLACE FUNCTION public.registrar_crm_audit(
  p_agendamento_id uuid,
  p_acao text,
  p_status_anterior text DEFAULT NULL,
  p_status_novo text DEFAULT NULL,
  p_detalhes jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_email text;
  v_name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT u.email, COALESCE(p.full_name, u.email)
    INTO v_email, v_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = auth.uid();

  INSERT INTO public.crm_audit_log (
    agendamento_id, user_id, user_email, user_name,
    acao, status_anterior, status_novo, detalhes
  ) VALUES (
    p_agendamento_id, auth.uid(), v_email, v_name,
    p_acao, p_status_anterior, p_status_novo, p_detalhes
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;