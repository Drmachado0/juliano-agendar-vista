CREATE UNIQUE INDEX IF NOT EXISTS uq_mensagens_whatsapp_externa_id
ON public.mensagens_whatsapp (mensagem_externa_id)
WHERE mensagem_externa_id IS NOT NULL;