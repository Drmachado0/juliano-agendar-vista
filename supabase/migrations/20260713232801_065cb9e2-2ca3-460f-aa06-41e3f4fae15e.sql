-- Rev-4 (idempotente): converte o único card confirmado de EXAMES para o novo status canônico EXAMES_HGP,
-- preservando o restante do funil e sem tocar em falsos positivos históricos.
UPDATE public.agendamentos
SET
  status_crm = 'EXAMES_HGP',
  status_funil = 'exames_hgp',
  tipo_atendimento = 'Exame',
  detalhe_exame_ou_cirurgia = COALESCE(NULLIF(detalhe_exame_ou_cirurgia, ''), 'Retinografia'),
  local_atendimento = 'Hospital Geral de Paragominas',
  bot_ativo = true,
  bot_pausado_ate = NULL,
  bot_pausa_motivo = NULL,
  motivo_status = 'valor_exame_tabelado',
  estado_atendimento = COALESCE(NULLIF(estado_atendimento, 'aguardando_humano'), 'coleta'),
  updated_at = now()
WHERE id = 'ff5ee055-58fe-40ca-a7df-3ddcdd661177'
  AND (status_crm = 'PRECISA_DE_HUMANO' OR status_crm IS NULL OR status_crm <> 'EXAMES_HGP');