-- Alerta de envio de WhatsApp fora do ar: tabela de dedupe + agendamento.
--
-- Contexto: o workflow n8n de POST /webhook/enviar-whatsapp foi despublicado em
-- 25/08/2026 e o envio parou por ~1h sem ninguem perceber. O registro continuava
-- sendo gravado em `mensagens_whatsapp`, entao o inbox do admin mostrava a
-- conversa como se a mensagem tivesse ido. A deteccao dependeu de abrir o
-- tooltip de um card no Kanban.
--
-- `alertas_sistema` existe para o alerta nao virar spam: sem ela, uma queda
-- noturna geraria um email a cada 15 minutos. A funcao so avisa de novo depois
-- da janela de dedupe.

CREATE TABLE IF NOT EXISTS public.alertas_sistema (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo       text NOT NULL,
  detalhe    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.alertas_sistema IS
  'Alertas operacionais ja disparados. Usada para dedupe (nao reenviar o mesmo alerta em janela curta).';

-- A consulta de dedupe e sempre (tipo, created_at recente).
CREATE INDEX IF NOT EXISTS alertas_sistema_tipo_created_idx
  ON public.alertas_sistema (tipo, created_at DESC);

-- RLS ligada e SEM policy: apenas service_role (que a ignora) escreve/le.
-- Nao ha tela de admin consumindo esta tabela ainda; quando houver, adicionar
-- uma policy de leitura para admin em vez de afrouxar aqui.
ALTER TABLE public.alertas_sistema ENABLE ROW LEVEL SECURITY;

-- A cada 15 min. Janela de analise da funcao e de 30 min, entao uma queda e
-- vista mesmo se uma execucao falhar. Reaproveita `public._cron_headers()`,
-- criada na migration 20260712223249.
DO $mig$
DECLARE
  v_url constant text :=
    'https://cnpifhaszbonwlqruwnn.supabase.co/functions/v1/alerta-envio-whatsapp-fora';
BEGIN
  PERFORM cron.schedule(
    'alerta-envio-whatsapp-fora',
    '*/15 * * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := public._cron_headers(),
        body := jsonb_build_object('ts', now(), 'src', 'pg_cron')
      );
    $cron$, v_url)
  );
END $mig$;