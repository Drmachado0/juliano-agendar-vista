
-- 1) Intervalos em configuracoes_envio
ALTER TABLE public.configuracoes_envio
  ADD COLUMN IF NOT EXISTS intervalo_min_segundos integer NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS intervalo_max_segundos integer NOT NULL DEFAULT 210;

CREATE OR REPLACE FUNCTION public.validar_intervalo_envio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.intervalo_min_segundos < 30 THEN
    RAISE EXCEPTION 'intervalo_min_segundos deve ser >= 30';
  END IF;
  IF NEW.intervalo_max_segundos < NEW.intervalo_min_segundos THEN
    RAISE EXCEPTION 'intervalo_max_segundos deve ser >= intervalo_min_segundos';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_intervalo_envio ON public.configuracoes_envio;
CREATE TRIGGER trg_validar_intervalo_envio
BEFORE INSERT OR UPDATE ON public.configuracoes_envio
FOR EACH ROW EXECUTE FUNCTION public.validar_intervalo_envio();

-- 2) Tabela de variações de templates
CREATE TABLE IF NOT EXISTS public.templates_whatsapp_variacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_tipo text NOT NULL,
  nome text NOT NULL,
  conteudo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  peso integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_twv_tipo_ativo
  ON public.templates_whatsapp_variacoes (template_tipo, ativo);

ALTER TABLE public.templates_whatsapp_variacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage templates_whatsapp_variacoes" ON public.templates_whatsapp_variacoes;
CREATE POLICY "Admins manage templates_whatsapp_variacoes"
ON public.templates_whatsapp_variacoes
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_twv_updated_at ON public.templates_whatsapp_variacoes;
CREATE TRIGGER trg_twv_updated_at
BEFORE UPDATE ON public.templates_whatsapp_variacoes
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) Logs adicionais
ALTER TABLE public.logs_envio_lembrete
  ADD COLUMN IF NOT EXISTS variacao_id uuid,
  ADD COLUMN IF NOT EXISTS variacao_nome text,
  ADD COLUMN IF NOT EXISTS delay_antes_ms integer,
  ADD COLUMN IF NOT EXISTS delay_depois_ms integer,
  ADD COLUMN IF NOT EXISTS status_global_no_envio text;

-- 4) Seed das variações iniciais para lembrete_anual
INSERT INTO public.templates_whatsapp_variacoes (template_tipo, nome, conteudo, ativo, peso)
SELECT 'lembrete_anual', 'Padrão – cordial', $msg$Olá, {{nome}}! 👋

Já faz cerca de 1 ano desde sua última consulta oftalmológica conosco.

Manter seus exames em dia é fundamental para a saúde dos seus olhos. 👀

Gostaria de agendar seu retorno?

📱 Agende pelo nosso site:
👉 https://drjulianomachado.com/agendamento

Atenciosamente,
Dr. Juliano Machado
Oftalmologia$msg$, true, 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.templates_whatsapp_variacoes WHERE template_tipo = 'lembrete_anual'
);

INSERT INTO public.templates_whatsapp_variacoes (template_tipo, nome, conteudo, ativo, peso)
SELECT 'lembrete_anual', 'Curto – direto', $msg$Oi, {{nome}}! Tudo bem?

Faz aproximadamente 1 ano da sua última consulta com o Dr. Juliano Machado. Que tal cuidar da saúde dos seus olhos e marcar seu retorno?

Agende online:
👉 https://drjulianomachado.com/agendamento$msg$, true, 1
WHERE (SELECT count(*) FROM public.templates_whatsapp_variacoes WHERE template_tipo = 'lembrete_anual') < 2;

INSERT INTO public.templates_whatsapp_variacoes (template_tipo, nome, conteudo, ativo, peso)
SELECT 'lembrete_anual', 'Pergunta – aberta', $msg$Olá, {{nome}}! 😊

Aqui é da clínica do Dr. Juliano Machado. Já se passou cerca de 1 ano desde sua última avaliação oftalmológica.

Posso te ajudar a encontrar um horário para seu retorno?

Se preferir agendar direto:
👉 https://drjulianomachado.com/agendamento$msg$, true, 1
WHERE (SELECT count(*) FROM public.templates_whatsapp_variacoes WHERE template_tipo = 'lembrete_anual') < 3;
