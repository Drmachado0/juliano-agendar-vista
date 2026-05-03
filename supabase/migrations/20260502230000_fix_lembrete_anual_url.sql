-- Fix legacy domain in lembrete_anual template:
-- drjulianomachado.com.br/agendar -> drjulianomachado.com/agendamento
-- (canonical site domain is .com, sem .br; landing canonical é /agendamento)

UPDATE public.templates_whatsapp
SET conteudo = REPLACE(
  conteudo,
  'https://drjulianomachado.com.br/agendar',
  'https://drjulianomachado.com/agendamento'
)
WHERE conteudo LIKE '%drjulianomachado.com.br/agendar%';
