-- Tabela para cachear verificações de números WhatsApp
CREATE TABLE public.verificacoes_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL,
  existe_whatsapp boolean NOT NULL,
  jid text,
  verificado_em timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Índice único para telefone (evitar duplicatas)
CREATE UNIQUE INDEX idx_verificacoes_whatsapp_telefone ON public.verificacoes_whatsapp(telefone);

-- Índice para buscar números inválidos
CREATE INDEX idx_verificacoes_whatsapp_invalidos ON public.verificacoes_whatsapp(existe_whatsapp) WHERE existe_whatsapp = false;

-- Enable RLS
ALTER TABLE public.verificacoes_whatsapp ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - apenas admins podem gerenciar
CREATE POLICY "Admins can manage verificacoes_whatsapp"
  ON public.verificacoes_whatsapp
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_verificacoes_whatsapp_updated_at
  BEFORE UPDATE ON public.verificacoes_whatsapp
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();