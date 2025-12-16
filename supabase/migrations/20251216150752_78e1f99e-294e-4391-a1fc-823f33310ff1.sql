-- Remove the overly permissive public INSERT policy
DROP POLICY IF EXISTS "Anyone can create appointments" ON public.agendamentos;

-- Create INSERT policy restricted to admins only
-- Public appointments are created via edge function which uses service_role_key (bypasses RLS)
CREATE POLICY "Admins can create appointments" 
ON public.agendamentos
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));