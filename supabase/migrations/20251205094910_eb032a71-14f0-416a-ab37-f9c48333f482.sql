-- Tabela de disponibilidade semanal padrão
CREATE TABLE public.disponibilidade_semanal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  intervalo_minutos INTEGER NOT NULL DEFAULT 30,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dia_semana)
);

-- Tabela de disponibilidade específica (sobrescreve semanal)
CREATE TABLE public.disponibilidade_especifica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL UNIQUE,
  hora_inicio TIME,
  hora_fim TIME,
  intervalo_minutos INTEGER DEFAULT 30,
  disponivel BOOLEAN DEFAULT true,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.disponibilidade_semanal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disponibilidade_especifica ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Leitura pública (necessário para o formulário de agendamento)
CREATE POLICY "Anyone can view active disponibilidade_semanal"
ON public.disponibilidade_semanal
FOR SELECT
USING (ativo = true);

CREATE POLICY "Admins can manage disponibilidade_semanal"
ON public.disponibilidade_semanal
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view disponibilidade_especifica"
ON public.disponibilidade_especifica
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage disponibilidade_especifica"
ON public.disponibilidade_especifica
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_disponibilidade_semanal_updated_at
BEFORE UPDATE ON public.disponibilidade_semanal
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_disponibilidade_especifica_updated_at
BEFORE UPDATE ON public.disponibilidade_especifica
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed inicial de disponibilidade semanal
INSERT INTO public.disponibilidade_semanal (dia_semana, hora_inicio, hora_fim, intervalo_minutos, ativo) VALUES
(1, '08:00', '18:00', 30, true), -- Segunda
(2, '08:00', '18:00', 30, true), -- Terça
(3, '08:00', '18:00', 30, true), -- Quarta
(4, '08:00', '18:00', 30, true), -- Quinta
(5, '08:00', '18:00', 30, true), -- Sexta
(6, '08:00', '12:00', 30, true), -- Sábado
(0, '08:00', '12:00', 30, false); -- Domingo (desativado)