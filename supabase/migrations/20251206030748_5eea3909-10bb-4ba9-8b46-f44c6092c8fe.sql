-- Criar tabela de convênios
CREATE TABLE public.convenios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  valor_consulta DECIMAL(10,2) NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de tipos de atendimento
CREATE TABLE public.tipos_atendimento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  descricao TEXT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.convenios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_atendimento ENABLE ROW LEVEL SECURITY;

-- Policies for convenios
CREATE POLICY "Anyone can view active convenios" ON public.convenios
  FOR SELECT USING (ativo = true);

CREATE POLICY "Admins can manage convenios" ON public.convenios
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies for tipos_atendimento
CREATE POLICY "Anyone can view active tipos_atendimento" ON public.tipos_atendimento
  FOR SELECT USING (ativo = true);

CREATE POLICY "Admins can manage tipos_atendimento" ON public.tipos_atendimento
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default convenios
INSERT INTO public.convenios (nome, slug, valor_consulta, ativo) VALUES
  ('Particular', 'particular', 250.00, true),
  ('Bradesco', 'bradesco', NULL, true),
  ('Unimed', 'unimed', NULL, true),
  ('Cassi', 'cassi', NULL, true),
  ('Sul América', 'sulamerica', NULL, true);

-- Insert default tipos de atendimento
INSERT INTO public.tipos_atendimento (nome, slug, descricao, ativo) VALUES
  ('Consulta', 'consulta', NULL, true),
  ('Retorno', 'retorno', NULL, true),
  ('Exame', 'exame', 'Campo visual, OCT, mapeamento etc.', true),
  ('Cirurgia', 'cirurgia', 'Catarata, pterígio etc.', true);

-- Add triggers for updated_at
CREATE TRIGGER update_convenios_updated_at
  BEFORE UPDATE ON public.convenios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tipos_atendimento_updated_at
  BEFORE UPDATE ON public.tipos_atendimento
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();