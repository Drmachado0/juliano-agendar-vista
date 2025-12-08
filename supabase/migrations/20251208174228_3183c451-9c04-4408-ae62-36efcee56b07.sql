-- Create table for 2FA configuration
CREATE TABLE public.two_factor_auth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  totp_secret_encrypted bytea, -- Encrypted TOTP secret
  totp_enabled boolean DEFAULT false,
  backup_codes_encrypted bytea, -- Encrypted backup codes (JSON array)
  backup_codes_used text[] DEFAULT '{}', -- Track used backup codes
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  verified_at timestamp with time zone -- When 2FA was successfully verified/enabled
);

-- Enable RLS
ALTER TABLE public.two_factor_auth ENABLE ROW LEVEL SECURITY;

-- Only allow users to view/manage their own 2FA settings
CREATE POLICY "Users can view own 2FA settings"
  ON public.two_factor_auth
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own 2FA settings"
  ON public.two_factor_auth
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own 2FA settings"
  ON public.two_factor_auth
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own 2FA settings"
  ON public.two_factor_auth
  FOR DELETE
  USING (user_id = auth.uid());

-- Function to encrypt 2FA secret (admin/service role only)
CREATE OR REPLACE FUNCTION public.encrypt_totp_secret(plain_secret text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  SELECT decrypted_secret INTO encryption_key
  FROM vault.decrypted_secrets
  WHERE name = 'ENCRYPTION_KEY'
  LIMIT 1;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  RETURN pgp_sym_encrypt(plain_secret, encryption_key);
END;
$$;

-- Function to decrypt 2FA secret (admin/service role only)
CREATE OR REPLACE FUNCTION public.decrypt_totp_secret(encrypted_secret bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  SELECT decrypted_secret INTO encryption_key
  FROM vault.decrypted_secrets
  WHERE name = 'ENCRYPTION_KEY'
  LIMIT 1;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  IF encrypted_secret IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN pgp_sym_decrypt(encrypted_secret, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Revoke direct access to encryption functions
REVOKE EXECUTE ON FUNCTION public.encrypt_totp_secret(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_totp_secret(bytea) FROM PUBLIC;

-- Create trigger for updated_at
CREATE TRIGGER update_two_factor_auth_updated_at
  BEFORE UPDATE ON public.two_factor_auth
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();