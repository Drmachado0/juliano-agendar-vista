-- ETAPA 1: Criar novas tabelas para agenda multiclínicas

-- Tabela de Clínicas
CREATE TABLE clinicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  endereco TEXT,
  telefone TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Profissionais
CREATE TABLE profissionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cargo TEXT,
  telefone TEXT,
  email TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Serviços (com duração fixa)
CREATE TABLE servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  duracao_min INTEGER NOT NULL DEFAULT 30,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de relacionamento Profissional-Clínica (muitos para muitos)
CREATE TABLE profissional_clinica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
  clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profissional_id, clinica_id)
);

-- ETAPA 2: Tabela de bloqueios de agenda
CREATE TABLE bloqueios_agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  profissional_id UUID REFERENCES profissionais(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  hora_inicio TIME,
  hora_fim TIME,
  tipo_bloqueio TEXT NOT NULL CHECK (tipo_bloqueio IN ('dia_inteiro', 'intervalo', 'ausencia_profissional', 'feriado')),
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar colunas FK opcionais na tabela agendamentos
ALTER TABLE agendamentos 
  ADD COLUMN IF NOT EXISTS clinica_id UUID REFERENCES clinicas(id),
  ADD COLUMN IF NOT EXISTS profissional_id UUID REFERENCES profissionais(id),
  ADD COLUMN IF NOT EXISTS servico_id UUID REFERENCES servicos(id),
  ADD COLUMN IF NOT EXISTS confirmacao_enviada BOOLEAN DEFAULT false;

-- Adicionar coluna tipo_mensagem em mensagens_whatsapp
ALTER TABLE mensagens_whatsapp 
  ADD COLUMN IF NOT EXISTS tipo_mensagem TEXT DEFAULT 'manual';

-- Triggers para updated_at
CREATE TRIGGER update_clinicas_updated_at
  BEFORE UPDATE ON clinicas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profissionais_updated_at
  BEFORE UPDATE ON profissionais
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_servicos_updated_at
  BEFORE UPDATE ON servicos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bloqueios_agenda_updated_at
  BEFORE UPDATE ON bloqueios_agenda
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS em todas as novas tabelas
ALTER TABLE clinicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE profissional_clinica ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueios_agenda ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para clinicas
CREATE POLICY "Anyone can view active clinicas" ON clinicas
  FOR SELECT USING (ativo = true);

CREATE POLICY "Admins can manage clinicas" ON clinicas
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Políticas RLS para profissionais
CREATE POLICY "Anyone can view active profissionais" ON profissionais
  FOR SELECT USING (ativo = true);

CREATE POLICY "Admins can manage profissionais" ON profissionais
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Políticas RLS para servicos
CREATE POLICY "Anyone can view active servicos" ON servicos
  FOR SELECT USING (ativo = true);

CREATE POLICY "Admins can manage servicos" ON servicos
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Políticas RLS para profissional_clinica
CREATE POLICY "Anyone can view profissional_clinica" ON profissional_clinica
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage profissional_clinica" ON profissional_clinica
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Políticas RLS para bloqueios_agenda
CREATE POLICY "Admins can view bloqueios" ON bloqueios_agenda
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage bloqueios" ON bloqueios_agenda
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Habilitar Realtime para bloqueios_agenda
ALTER PUBLICATION supabase_realtime ADD TABLE bloqueios_agenda;

-- SEEDS: Clínicas iniciais
INSERT INTO clinicas (nome, slug, endereco, telefone) VALUES
  ('Clinicor – Paragominas', 'clinicor', 'Rua Eixo W1, R. Célio Miranda, N° 729, Paragominas - PA', '(91) 98165-3200'),
  ('Hospital Geral de Paragominas', 'hgp', 'R. Santa Terezinha, 304 - Centro, Paragominas - PA', '(91) 9100-0303'),
  ('Instituto de Olhos de Belém (IOB)', 'iob', 'Av. Generalíssimo Deodoro, 904 - Nazaré, Belém - PA', '(91) 3239-4600'),
  ('Vitria Oftalmologia', 'vitria', 'Av. Conselheiro Furtado, 2865 - Sobreloja, São Braz, Belém - PA', '(91) 3342-1463');

-- SEEDS: Serviços com duração
INSERT INTO servicos (nome, duracao_min, descricao) VALUES
  ('Consulta', 30, 'Consulta oftalmológica completa'),
  ('Retorno', 20, 'Retorno de consulta'),
  ('Exame - OCT', 45, 'Tomografia de coerência óptica'),
  ('Exame - Mapeamento de Retina', 40, 'Exame de mapeamento de retina'),
  ('Exame - Campo Visual', 30, 'Exame de campo visual computadorizado'),
  ('Exame - Tonometria', 15, 'Medição da pressão intraocular'),
  ('Cirurgia - Catarata', 60, 'Facoemulsificação com implante de LIO'),
  ('Cirurgia - Pterígio', 45, 'Remoção cirúrgica de pterígio');