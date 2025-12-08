-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted column for observacoes_internas
ALTER TABLE public.agendamentos 
ADD COLUMN IF NOT EXISTS observacoes_internas_encrypted bytea;

-- Create function to encrypt text using the ENCRYPTION_KEY secret
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(plain_text text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  -- Get encryption key from vault (stored as a secret)
  SELECT decrypted_secret INTO encryption_key
  FROM vault.decrypted_secrets
  WHERE name = 'ENCRYPTION_KEY'
  LIMIT 1;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found in vault';
  END IF;
  
  IF plain_text IS NULL OR plain_text = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN pgp_sym_encrypt(plain_text, encryption_key);
END;
$$;

-- Create function to decrypt text using the ENCRYPTION_KEY secret
CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(encrypted_data bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  -- Get encryption key from vault (stored as a secret)
  SELECT decrypted_secret INTO encryption_key
  FROM vault.decrypted_secrets
  WHERE name = 'ENCRYPTION_KEY'
  LIMIT 1;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found in vault';
  END IF;
  
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN pgp_sym_decrypt(encrypted_data, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    -- Return NULL if decryption fails (corrupted data or wrong key)
    RETURN NULL;
END;
$$;

-- Create a view for admins to access decrypted observations
CREATE OR REPLACE VIEW public.agendamentos_com_observacoes AS
SELECT 
  a.*,
  CASE 
    WHEN a.observacoes_internas_encrypted IS NOT NULL 
    THEN public.decrypt_sensitive_data(a.observacoes_internas_encrypted)
    ELSE a.observacoes_internas  -- Fallback for unencrypted data during migration
  END as observacoes_decrypted
FROM public.agendamentos a;

-- Grant access to the view only for authenticated users (RLS will further restrict)
GRANT SELECT ON public.agendamentos_com_observacoes TO authenticated;

-- Create trigger to automatically encrypt observacoes_internas on insert/update
CREATE OR REPLACE FUNCTION public.encrypt_observacoes_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If observacoes_internas has content, encrypt it
  IF NEW.observacoes_internas IS NOT NULL AND NEW.observacoes_internas != '' THEN
    NEW.observacoes_internas_encrypted := public.encrypt_sensitive_data(NEW.observacoes_internas);
    -- Clear the plaintext field after encryption
    NEW.observacoes_internas := '[ENCRYPTED]';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS encrypt_observacoes_on_change ON public.agendamentos;
CREATE TRIGGER encrypt_observacoes_on_change
  BEFORE INSERT OR UPDATE OF observacoes_internas ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_observacoes_trigger();

-- Migrate existing plaintext data to encrypted (one-time migration)
UPDATE public.agendamentos
SET observacoes_internas_encrypted = public.encrypt_sensitive_data(observacoes_internas),
    observacoes_internas = '[ENCRYPTED]'
WHERE observacoes_internas IS NOT NULL 
  AND observacoes_internas != '' 
  AND observacoes_internas != '[ENCRYPTED]'
  AND observacoes_internas_encrypted IS NULL;