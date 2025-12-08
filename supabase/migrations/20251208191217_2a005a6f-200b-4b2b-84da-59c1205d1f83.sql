-- Create a secure setup_totp function that accepts parameters safely
CREATE OR REPLACE FUNCTION public.setup_totp(
  p_user_id uuid,
  p_secret text,
  p_backup_codes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete existing record if any
  DELETE FROM public.two_factor_auth WHERE user_id = p_user_id;
  
  -- Insert new 2FA setup with encrypted secret and backup codes
  INSERT INTO public.two_factor_auth (
    user_id,
    totp_secret_encrypted,
    backup_codes_encrypted,
    totp_enabled,
    backup_codes_used,
    verified_at
  )
  VALUES (
    p_user_id,
    public.encrypt_totp_secret(p_secret),
    public.encrypt_totp_secret(p_backup_codes),
    false,
    '{}',
    NULL
  );
END;
$$;