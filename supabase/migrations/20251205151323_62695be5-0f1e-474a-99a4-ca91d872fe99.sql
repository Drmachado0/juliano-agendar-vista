-- Drop existing restrictive policies for disponibilidade_semanal
DROP POLICY IF EXISTS "Anyone can view active disponibilidade_semanal" ON public.disponibilidade_semanal;
DROP POLICY IF EXISTS "Admins can manage disponibilidade_semanal" ON public.disponibilidade_semanal;

-- Create permissive policies that work correctly
-- Admins can see ALL records (active or inactive)
CREATE POLICY "Admins can view all disponibilidade_semanal" 
ON public.disponibilidade_semanal 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Public users can only see active records
CREATE POLICY "Public can view active disponibilidade_semanal" 
ON public.disponibilidade_semanal 
FOR SELECT 
USING (ativo = true);

-- Admins can manage (insert, update, delete)
CREATE POLICY "Admins can manage disponibilidade_semanal" 
ON public.disponibilidade_semanal 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));