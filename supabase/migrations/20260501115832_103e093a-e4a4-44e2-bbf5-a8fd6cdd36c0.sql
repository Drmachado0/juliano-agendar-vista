ALTER FUNCTION public.encrypt_sensitive_data(text)   SET search_path = public, extensions;
ALTER FUNCTION public.decrypt_sensitive_data(bytea)   SET search_path = public, extensions;
ALTER FUNCTION public.encrypt_totp_secret(text)       SET search_path = public, extensions;
ALTER FUNCTION public.decrypt_totp_secret(bytea)      SET search_path = public, extensions;