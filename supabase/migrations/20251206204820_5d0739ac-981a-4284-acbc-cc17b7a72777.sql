-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Anyone can create appointments" ON public.agendamentos;

-- Create new PERMISSIVE INSERT policy for public users
CREATE POLICY "Anyone can create appointments" 
ON public.agendamentos
FOR INSERT
TO public
WITH CHECK (true);