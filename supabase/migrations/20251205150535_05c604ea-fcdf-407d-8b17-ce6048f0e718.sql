-- Allow admins to delete appointments
CREATE POLICY "Admins can delete appointments" 
ON public.agendamentos 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete related messages
CREATE POLICY "Admins can delete messages" 
ON public.mensagens_whatsapp 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));