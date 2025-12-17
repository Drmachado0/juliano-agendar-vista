-- Create lembretes_anuais table
CREATE TABLE public.lembretes_anuais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT NOT NULL,
  nome TEXT NOT NULL,
  primeiro_nome TEXT,
  data_ultima_consulta DATE NOT NULL,
  data_proximo_lembrete DATE GENERATED ALWAYS AS (data_ultima_consulta + INTERVAL '1 year') STORED,
  lembrete_enviado BOOLEAN DEFAULT false,
  lembrete_enviado_em TIMESTAMP WITH TIME ZONE,
  origem TEXT DEFAULT 'n8n',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(telefone, data_ultima_consulta)
);

-- Enable RLS
ALTER TABLE public.lembretes_anuais ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view lembretes_anuais"
ON public.lembretes_anuais FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert lembretes_anuais"
ON public.lembretes_anuais FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update lembretes_anuais"
ON public.lembretes_anuais FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete lembretes_anuais"
ON public.lembretes_anuais FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for quick lookups on pending reminders
CREATE INDEX idx_lembretes_proximo_pendente ON public.lembretes_anuais(data_proximo_lembrete) WHERE NOT lembrete_enviado;

-- Trigger for updated_at
CREATE TRIGGER update_lembretes_anuais_updated_at
BEFORE UPDATE ON public.lembretes_anuais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();