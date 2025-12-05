-- Remove a política atual que permite acesso a usuários autenticados
DROP POLICY IF EXISTS "Authenticated users can view active profissionais" ON public.profissionais;

-- Criar nova política de SELECT apenas para admins
CREATE POLICY "Only admins can view profissionais" 
ON public.profissionais 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));