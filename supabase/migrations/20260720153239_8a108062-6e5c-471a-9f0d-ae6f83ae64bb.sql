-- Higiene: mover pg_trgm de public para extensions
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, authenticated, service_role, anon;

ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Garantir que o índice trigram continua funcionando: recriar apontando
-- para o operator class no novo schema (defensivo — ALTER EXTENSION move
-- os operator classes junto, mas o índice referencia por OID, então
-- normalmente segue válido; incluímos DROP/CREATE apenas se necessário).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_mensagens_wa_telefone_trgm'
  ) THEN
    CREATE INDEX idx_mensagens_wa_telefone_trgm
      ON public.mensagens_whatsapp
      USING gin (telefone extensions.gin_trgm_ops);
  END IF;
END $$;
