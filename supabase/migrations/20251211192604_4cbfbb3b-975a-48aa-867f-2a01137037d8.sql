-- Create templates_whatsapp table for editable WhatsApp message templates
CREATE TABLE public.templates_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text UNIQUE NOT NULL,
  nome text NOT NULL,
  conteudo text NOT NULL,
  descricao text,
  variaveis_disponiveis text[] DEFAULT '{}',
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.templates_whatsapp ENABLE ROW LEVEL SECURITY;

-- Policies: Public can read active templates, admins can manage all
CREATE POLICY "Anyone can view active templates"
ON public.templates_whatsapp
FOR SELECT
USING (ativo = true);

CREATE POLICY "Admins can manage templates"
ON public.templates_whatsapp
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_templates_whatsapp_updated_at
BEFORE UPDATE ON public.templates_whatsapp
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates with current messages
INSERT INTO public.templates_whatsapp (tipo, nome, conteudo, descricao, variaveis_disponiveis) VALUES
(
  'confirmacao_agendamento',
  'Confirmação de Agendamento',
  'Olá, {{nome}}! 👋

Recebemos seu pedido de agendamento na clínica do *Dr. Juliano Machado - Oftalmologista*.

📅 *Data:* {{data}}
⏰ *Horário:* {{hora}}
📍 *Local:* {{local}}

⚠️ *Importante:* O atendimento será realizado por *ordem de chegada*. Recomendamos chegar com antecedência.

Caso precise reagendar ou cancelar, entre em contato conosco.

Agradecemos a preferência! 🙏',
  'Mensagem enviada quando o paciente realiza um novo agendamento',
  ARRAY['{{nome}}', '{{data}}', '{{hora}}', '{{local}}', '{{profissional}}', '{{tipo_atendimento}}', '{{convenio}}']
),
(
  'lembrete_24h',
  'Lembrete 24h Antes',
  'Olá, {{nome}}! 👋

Este é um lembrete do seu agendamento na clínica do *Dr. Juliano Machado - Oftalmologista*.

📅 *Data:* {{data}}
⏰ *Horário:* {{hora}}
📍 *Local:* {{local}}

⚠️ *Lembre-se:* O atendimento será por *ordem de chegada*.

Caso não possa comparecer, por favor nos avise.

Até amanhã! 🙏',
  'Lembrete automático enviado 24 horas antes da consulta',
  ARRAY['{{nome}}', '{{data}}', '{{hora}}', '{{local}}', '{{profissional}}', '{{tipo_atendimento}}']
),
(
  'resposta_confirmacao',
  'Resposta - Presença Confirmada',
  'Sua presença foi *confirmada* com sucesso! ✅

Aguardamos você na data e horário agendados.

Qualquer dúvida, estamos à disposição. 🙏',
  'Resposta automática quando paciente confirma presença',
  ARRAY['{{nome}}', '{{data}}', '{{hora}}']
),
(
  'resposta_cancelamento',
  'Resposta - Agendamento Cancelado',
  'Seu agendamento foi *cancelado* conforme solicitado. ❌

Caso deseje reagendar, acesse nosso site ou entre em contato.

Obrigado! 🙏',
  'Resposta automática quando paciente cancela agendamento',
  ARRAY['{{nome}}']
),
(
  'reagendamento',
  'Reagendamento de Consulta',
  'Olá, {{nome}}! 👋

Sua consulta foi *reagendada* para:

📅 *Nova Data:* {{data}}
⏰ *Novo Horário:* {{hora}}
📍 *Local:* {{local}}

⚠️ *Lembre-se:* O atendimento será por *ordem de chegada*.

Qualquer dúvida, estamos à disposição! 🙏',
  'Mensagem enviada quando um agendamento é alterado',
  ARRAY['{{nome}}', '{{data}}', '{{hora}}', '{{local}}', '{{profissional}}']
);