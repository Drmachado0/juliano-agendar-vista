
-- 1. RLS em horarios_disponiveis
ALTER TABLE public.horarios_disponiveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read horarios_disponiveis"
ON public.horarios_disponiveis FOR SELECT
USING (true);

CREATE POLICY "Admins manage horarios_disponiveis"
ON public.horarios_disponiveis FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. user_roles: políticas restritivas para escrita
CREATE POLICY "Only admins can insert user_roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update user_roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete user_roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. View pacientes: usar security_invoker
ALTER VIEW public.pacientes SET (security_invoker = true);

-- 4. Fixar search_path em funções públicas sem configuração
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
      ))
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END
$$;
