INSERT INTO public.templates_whatsapp (tipo, nome, descricao, conteudo, variaveis_disponiveis, ativo)
VALUES (
  'lembrete_anual',
  'Lembrete Anual de Retorno',
  'Mensagem enviada a pacientes 1 ano após a última consulta oftalmológica',
  E'Olá, {{nome}}! 👋\n\nJá faz 1 ano desde sua última consulta oftalmológica conosco.\n\nManter seus exames em dia é fundamental para a saúde dos seus olhos. 👀\n\nGostaria de agendar seu retorno? Podemos encontrar o melhor horário para você.\n\n📱 Agende pelo WhatsApp ou pelo nosso site:\n👉 https://drjulianomachado.com.br/agendar\n\nAtenciosamente,\nDr. Juliano Machado\nOftalmologia',
  ARRAY['{{nome}}']::text[],
  true
)
ON CONFLICT (tipo) DO NOTHING;