-- Garantir payload completo nos eventos
ALTER TABLE public.crm_audit_log REPLICA IDENTITY FULL;

-- Adicionar à publicação do realtime (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'crm_audit_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_audit_log;
  END IF;
END $$;