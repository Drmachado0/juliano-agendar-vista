-- Tabela: classificações de intenção por mensagem/conversa
CREATE TABLE IF NOT EXISTS public.conversation_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  mensagem_id uuid REFERENCES public.mensagens_whatsapp(id) ON DELETE SET NULL,
  telefone text NOT NULL,
  intencao text NOT NULL,
  confianca numeric(3,2),
  resumo text,
  sentimento text,
  proxima_acao text,
  modelo text NOT NULL DEFAULT 'openai/gpt-5-mini',
  raw_output jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_intents_agendamento ON public.conversation_intents(agendamento_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_intents_telefone ON public.conversation_intents(telefone, created_at DESC);

ALTER TABLE public.conversation_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view conversation intents"
  ON public.conversation_intents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert conversation intents"
  ON public.conversation_intents FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete conversation intents"
  ON public.conversation_intents FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Tabela: log de ações do assistente bot
CREATE TABLE IF NOT EXISTS public.bot_assistente_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  mensagem_id uuid REFERENCES public.mensagens_whatsapp(id) ON DELETE SET NULL,
  telefone text NOT NULL,
  acao text NOT NULL, -- 'classificou','ignorou','enviou_horarios','criou_agendamento','erro'
  intencao text,
  detalhes jsonb,
  latencia_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_log_telefone ON public.bot_assistente_log(telefone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_log_agendamento ON public.bot_assistente_log(agendamento_id, created_at DESC);

ALTER TABLE public.bot_assistente_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view bot log"
  ON public.bot_assistente_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Flag em agendamentos para controlar/desligar bot por lead
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS bot_ativo boolean NOT NULL DEFAULT true;

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS bot_ultima_acao_at timestamptz;

-- RPC: registrar log do bot (service role bypassa, mas mantemos definer p/ consistência)
CREATE OR REPLACE FUNCTION public.registrar_bot_log(
  p_telefone text,
  p_acao text,
  p_agendamento_id uuid DEFAULT NULL,
  p_mensagem_id uuid DEFAULT NULL,
  p_intencao text DEFAULT NULL,
  p_detalhes jsonb DEFAULT NULL,
  p_latencia_ms integer DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.bot_assistente_log (
    agendamento_id, mensagem_id, telefone, acao, intencao, detalhes, latencia_ms
  ) VALUES (
    p_agendamento_id, p_mensagem_id, p_telefone, p_acao, p_intencao, p_detalhes, p_latencia_ms
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;