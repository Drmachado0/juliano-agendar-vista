-- Bloco 2 de performance: índices para as queries mais custosas do CRM

-- 1) mensagens_whatsapp: buscas por sufixo do telefone (ILIKE '%last8')
--    são a query #1 em tempo total (~654s / 27k chamadas). btree não cobre
--    ILIKE com curinga à esquerda; usar trigram GIN resolve.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_mensagens_wa_telefone_trgm
  ON public.mensagens_whatsapp
  USING gin (telefone gin_trgm_ops);

-- 2) agendamentos: query #2 (~187s) faz range por created_at.
--    Não existe índice cobrindo created_at sozinho.
CREATE INDEX IF NOT EXISTS idx_agendamentos_created_at
  ON public.agendamentos (created_at DESC);
