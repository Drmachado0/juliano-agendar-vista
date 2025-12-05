-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Anyone can create appointments" ON public.agendamentos;

-- Create a new PERMISSIVE policy for public INSERT
CREATE POLICY "Anyone can create appointments" 
ON public.agendamentos 
FOR INSERT 
TO public
WITH CHECK (true);