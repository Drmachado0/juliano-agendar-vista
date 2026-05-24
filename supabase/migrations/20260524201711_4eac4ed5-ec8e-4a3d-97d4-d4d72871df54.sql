-- 1. Allow 'pendente' status on mensagens_whatsapp
ALTER TABLE public.mensagens_whatsapp DROP CONSTRAINT IF EXISTS mensagens_whatsapp_status_envio_check;
ALTER TABLE public.mensagens_whatsapp ADD CONSTRAINT mensagens_whatsapp_status_envio_check
  CHECK (status_envio = ANY (ARRAY['enviado'::text, 'entregue'::text, 'lido'::text, 'erro'::text, 'recebida'::text, 'pendente'::text]));

-- 2. Unique partial index to guarantee only ONE boas_vindas OUT per agendamento
CREATE UNIQUE INDEX IF NOT EXISTS mensagens_whatsapp_boas_vindas_unique
  ON public.mensagens_whatsapp (agendamento_id)
  WHERE tipo_mensagem = 'boas_vindas' AND direcao = 'OUT';