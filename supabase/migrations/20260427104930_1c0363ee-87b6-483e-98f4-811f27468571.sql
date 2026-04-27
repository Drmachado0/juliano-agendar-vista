-- Tabela de drafts/sugestões geradas pelo Hermes (IA assistente do WhatsApp)
CREATE TABLE public.hermes_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  telefone text,
  -- Conteúdo
  sugestao text NOT NULL,
  conteudo_final text,
  instrucao text,
  -- Metadados de geração
  modelo text NOT NULL DEFAULT 'openai/gpt-5-mini',
  latencia_ms integer,
  contexto_resumo jsonb,
  -- Estado da sugestão
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','edited','discarded','sent','error')),
  -- Quem gerou / quem usou
  created_by uuid,
  used_by uuid,
  used_at timestamptz,
  mensagem_id uuid REFERENCES public.mensagens_whatsapp(id) ON DELETE SET NULL,
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hermes_drafts_agendamento ON public.hermes_drafts(agendamento_id);
CREATE INDEX idx_hermes_drafts_status ON public.hermes_drafts(status);
CREATE INDEX idx_hermes_drafts_created_at ON public.hermes_drafts(created_at DESC);
CREATE INDEX idx_hermes_drafts_created_by ON public.hermes_drafts(created_by);

-- Trigger updated_at
CREATE TRIGGER trg_hermes_drafts_updated_at
BEFORE UPDATE ON public.hermes_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: apenas admins
ALTER TABLE public.hermes_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view hermes drafts"
ON public.hermes_drafts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert hermes drafts"
ON public.hermes_drafts FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update hermes drafts"
ON public.hermes_drafts FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete hermes drafts"
ON public.hermes_drafts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RPC para o atendente marcar a sugestão como usada/editada/descartada
CREATE OR REPLACE FUNCTION public.marcar_hermes_draft_status(
  p_draft_id uuid,
  p_status text,
  p_conteudo_final text DEFAULT NULL,
  p_mensagem_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF p_status NOT IN ('pending','accepted','edited','discarded','sent','error') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE public.hermes_drafts
  SET status = p_status,
      conteudo_final = COALESCE(p_conteudo_final, conteudo_final),
      mensagem_id = COALESCE(p_mensagem_id, mensagem_id),
      used_by = auth.uid(),
      used_at = CASE WHEN p_status IN ('sent','accepted','edited') THEN now() ELSE used_at END,
      updated_at = now()
  WHERE id = p_draft_id;
END;
$$;