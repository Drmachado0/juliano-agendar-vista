-- Create mensagens_whatsapp table for WhatsApp message history
CREATE TABLE public.mensagens_whatsapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  direcao TEXT NOT NULL CHECK (direcao IN ('IN', 'OUT')),
  conteudo TEXT NOT NULL,
  status_envio TEXT DEFAULT 'enviado' CHECK (status_envio IN ('enviado', 'entregue', 'lido', 'erro')),
  mensagem_externa_id TEXT,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_mensagens_whatsapp_agendamento_id ON public.mensagens_whatsapp(agendamento_id);
CREATE INDEX idx_mensagens_whatsapp_telefone ON public.mensagens_whatsapp(telefone);
CREATE INDEX idx_mensagens_whatsapp_created_at ON public.mensagens_whatsapp(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.mensagens_whatsapp ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can access messages
CREATE POLICY "Admins can view all messages"
ON public.mensagens_whatsapp
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert messages"
ON public.mensagens_whatsapp
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update messages"
ON public.mensagens_whatsapp
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Enable Supabase Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_whatsapp;