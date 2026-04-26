CREATE TABLE public.status_acesso_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agendamento_id uuid NOT NULL,
  ip_address text,
  user_agent text,
  referer text,
  status_exibido text,
  confirmation_status text,
  status_funil text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_acesso_log_agendamento ON public.status_acesso_log(agendamento_id);
CREATE INDEX idx_status_acesso_log_created_at ON public.status_acesso_log(created_at DESC);

ALTER TABLE public.status_acesso_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view status access log"
ON public.status_acesso_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));