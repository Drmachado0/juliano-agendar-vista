-- Remove the public SELECT policy
DROP POLICY IF EXISTS "Anyone can view active profissionais" ON public.profissionais;

-- Create new policy that only allows authenticated users to view profissionais
CREATE POLICY "Authenticated users can view active profissionais" 
ON public.profissionais 
FOR SELECT 
TO authenticated
USING (ativo = true);