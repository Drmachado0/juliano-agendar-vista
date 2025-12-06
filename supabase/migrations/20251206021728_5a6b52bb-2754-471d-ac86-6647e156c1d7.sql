-- ETAPA 7: Adicionar campos de confirmação na tabela agendamentos
ALTER TABLE public.agendamentos 
ADD COLUMN IF NOT EXISTS confirmation_status text DEFAULT 'nao_enviado',
ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS confirmation_response_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS confirmation_channel text;

-- Adicionar constraint de valores válidos para confirmation_status
ALTER TABLE public.agendamentos 
ADD CONSTRAINT check_confirmation_status 
CHECK (confirmation_status IN ('nao_enviado', 'aguardando_confirmacao', 'confirmado', 'cancelado_pelo_paciente', 'falha_envio'));

-- Migrar dados existentes: se confirmacao_enviada = true, marcar como aguardando_confirmacao
UPDATE public.agendamentos 
SET confirmation_status = 'aguardando_confirmacao' 
WHERE confirmacao_enviada = true AND confirmation_status = 'nao_enviado';

-- Adicionar campos extras na tabela mensagens_whatsapp para logs completos
ALTER TABLE public.mensagens_whatsapp
ADD COLUMN IF NOT EXISTS payload jsonb,
ADD COLUMN IF NOT EXISTS error_message text;

-- Criar índice para busca eficiente de agendamentos pendentes de confirmação
CREATE INDEX IF NOT EXISTS idx_agendamentos_confirmation_status 
ON public.agendamentos(confirmation_status, data_agendamento) 
WHERE confirmation_status IN ('nao_enviado', 'falha_envio');