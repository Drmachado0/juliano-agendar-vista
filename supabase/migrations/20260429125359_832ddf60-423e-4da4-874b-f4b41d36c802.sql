-- ============================================================
-- Persistência das Campanhas Mensais de Lembretes Anuais
-- ============================================================

-- 1) Campanha (uma por mês de vencimento)
CREATE TABLE IF NOT EXISTS public.lembretes_campanhas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ano_referencia integer NOT NULL,
  mes_referencia integer NOT NULL CHECK (mes_referencia BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'planejada',
  total_elegivel integer NOT NULL DEFAULT 0,
  total_enviados integer NOT NULL DEFAULT 0,
  total_falhas integer NOT NULL DEFAULT 0,
  total_ignorados integer NOT NULL DEFAULT 0,
  inconsistencias integer NOT NULL DEFAULT 0,
  gerada_em timestamptz NOT NULL DEFAULT now(),
  concluida_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ano_referencia, mes_referencia)
);

-- 2) Remessas (4 por campanha)
CREATE TABLE IF NOT EXISTS public.lembretes_campanha_remessas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campanha_id uuid NOT NULL REFERENCES public.lembretes_campanhas(id) ON DELETE CASCADE,
  numero_remessa integer NOT NULL CHECK (numero_remessa BETWEEN 1 AND 4),
  data_programada date NOT NULL,
  status text NOT NULL DEFAULT 'agendada',
  quantidade_planejada integer NOT NULL DEFAULT 0,
  processados integer NOT NULL DEFAULT 0,
  enviados integer NOT NULL DEFAULT 0,
  falhas integer NOT NULL DEFAULT 0,
  ignorados integer NOT NULL DEFAULT 0,
  motivo_bloqueio text,
  inicio_em timestamptz,
  fim_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campanha_id, numero_remessa)
);

CREATE INDEX IF NOT EXISTS idx_remessas_campanha ON public.lembretes_campanha_remessas(campanha_id);

-- 3) Pacientes da remessa (snapshot congelado)
CREATE TABLE IF NOT EXISTS public.lembretes_campanha_pacientes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campanha_id uuid NOT NULL REFERENCES public.lembretes_campanhas(id) ON DELETE CASCADE,
  remessa_id uuid NOT NULL REFERENCES public.lembretes_campanha_remessas(id) ON DELETE CASCADE,
  numero_remessa integer NOT NULL,
  lembrete_id uuid NOT NULL,
  nome text NOT NULL,
  telefone text NOT NULL,
  primeiro_nome text,
  data_ultima_consulta date,
  inconsistente_data boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pendente',
  motivo_falha text,
  motivo_ignorado text,
  ultimo_envio_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campanha_id, lembrete_id)
);

CREATE INDEX IF NOT EXISTS idx_pacientes_remessa ON public.lembretes_campanha_pacientes(remessa_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_campanha ON public.lembretes_campanha_pacientes(campanha_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_status ON public.lembretes_campanha_pacientes(status);

-- ============================================================
-- RLS — apenas admins
-- ============================================================
ALTER TABLE public.lembretes_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lembretes_campanha_remessas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lembretes_campanha_pacientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage lembretes_campanhas"
  ON public.lembretes_campanhas FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage lembretes_campanha_remessas"
  ON public.lembretes_campanha_remessas FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage lembretes_campanha_pacientes"
  ON public.lembretes_campanha_pacientes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- Triggers para updated_at
-- ============================================================
CREATE TRIGGER trg_lembretes_campanhas_updated
  BEFORE UPDATE ON public.lembretes_campanhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_lembretes_campanha_remessas_updated
  BEFORE UPDATE ON public.lembretes_campanha_remessas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_lembretes_campanha_pacientes_updated
  BEFORE UPDATE ON public.lembretes_campanha_pacientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();