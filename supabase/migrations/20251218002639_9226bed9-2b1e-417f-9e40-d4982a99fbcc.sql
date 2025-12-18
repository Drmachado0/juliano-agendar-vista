-- Criar tabela para armazenar avaliações do Google
CREATE TABLE public.avaliacoes_google (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_review_id TEXT UNIQUE NOT NULL,
  author_name TEXT NOT NULL,
  author_photo_url TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT,
  relative_time_description TEXT,
  time_epoch BIGINT,
  language TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.avaliacoes_google ENABLE ROW LEVEL SECURITY;

-- Política: leitura pública para avaliações ativas
CREATE POLICY "Public can view active reviews" 
ON public.avaliacoes_google 
FOR SELECT 
USING (ativo = true);

-- Política: admins podem gerenciar todas as avaliações
CREATE POLICY "Admins can manage reviews" 
ON public.avaliacoes_google 
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_avaliacoes_google_updated_at
BEFORE UPDATE ON public.avaliacoes_google
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar Realtime (opcional, para updates no admin)
ALTER PUBLICATION supabase_realtime ADD TABLE public.avaliacoes_google;