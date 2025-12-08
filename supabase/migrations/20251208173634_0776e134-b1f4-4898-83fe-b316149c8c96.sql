-- Drop the security definer view (security concern)
DROP VIEW IF EXISTS public.agendamentos_com_observacoes;

-- Instead, create a function to get decrypted observations for a specific agendamento
-- This is safer as it requires the caller to know the ID and has explicit access control
CREATE OR REPLACE FUNCTION public.get_observacoes_decrypted(agendamento_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result text;
  encrypted_data bytea;
  plain_data text;
  user_is_admin boolean;
BEGIN
  -- Check if the caller is an admin
  SELECT public.has_role(auth.uid(), 'admin') INTO user_is_admin;
  
  IF NOT user_is_admin THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  -- Get the encrypted and plain data
  SELECT observacoes_internas_encrypted, observacoes_internas 
  INTO encrypted_data, plain_data
  FROM public.agendamentos 
  WHERE id = agendamento_id;
  
  -- Return decrypted if encrypted exists, otherwise return plain
  IF encrypted_data IS NOT NULL THEN
    result := public.decrypt_sensitive_data(encrypted_data);
  ELSE
    result := plain_data;
  END IF;
  
  RETURN result;
END;
$$;

-- Revoke direct access to encryption functions from regular users
REVOKE EXECUTE ON FUNCTION public.encrypt_sensitive_data(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_sensitive_data(bytea) FROM PUBLIC;

-- Grant execute only to authenticated (but function checks admin internally)
GRANT EXECUTE ON FUNCTION public.get_observacoes_decrypted(uuid) TO authenticated;