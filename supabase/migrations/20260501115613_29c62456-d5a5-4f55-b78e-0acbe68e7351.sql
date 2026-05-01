-- Garante extensão pgcrypto para gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insere ENCRYPTION_KEY no Vault apenas se não existir lá
DO $$
DECLARE
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing
  FROM vault.secrets
  WHERE name = 'ENCRYPTION_KEY'
  LIMIT 1;

  IF v_existing IS NULL THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'ENCRYPTION_KEY',
      'Chave mestra para encrypt_sensitive_data / decrypt_sensitive_data (pgp_sym_encrypt)'
    );
  END IF;
END $$;