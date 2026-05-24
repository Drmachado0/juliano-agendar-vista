
-- Função: verifica se pode enviar mensagem outbound para um telefone
CREATE OR REPLACE FUNCTION public.pode_enviar_outbound(
  p_telefone text,
  p_tipo text,
  p_janela_minutos integer,
  p_max_msgs integer
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last8 text;
  v_count integer;
BEGIN
  v_last8 := right(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), 8);
  IF length(v_last8) < 8 THEN
    RETURN true; -- telefone inválido, deixa lógica de envio rejeitar
  END IF;

  SELECT count(*) INTO v_count
  FROM public.mensagens_whatsapp
  WHERE direcao = 'OUT'
    AND (p_tipo IS NULL OR tipo_mensagem = p_tipo)
    AND created_at > now() - make_interval(mins => p_janela_minutos)
    AND right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 8) = v_last8;

  RETURN v_count < p_max_msgs;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pode_enviar_outbound(text, text, integer, integer) TO authenticated, service_role;

-- Limpa duplicatas antes dos índices únicos parciais
WITH dups AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY agendamento_id, tipo_mensagem
           ORDER BY created_at ASC
         ) AS rn
  FROM public.mensagens_whatsapp
  WHERE direcao = 'OUT'
    AND agendamento_id IS NOT NULL
    AND tipo_mensagem IN ('confirmacao', 'lembrete_24h', 'lembrete_2h', 'agradecimento')
)
DELETE FROM public.mensagens_whatsapp m
USING dups
WHERE m.id = dups.id AND dups.rn > 1;

-- Índices únicos parciais (1 mensagem por agendamento por tipo crítico)
CREATE UNIQUE INDEX IF NOT EXISTS mensagens_whatsapp_confirmacao_unique
  ON public.mensagens_whatsapp (agendamento_id)
  WHERE tipo_mensagem = 'confirmacao' AND direcao = 'OUT' AND agendamento_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mensagens_whatsapp_lembrete_24h_unique
  ON public.mensagens_whatsapp (agendamento_id)
  WHERE tipo_mensagem = 'lembrete_24h' AND direcao = 'OUT' AND agendamento_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mensagens_whatsapp_lembrete_2h_unique
  ON public.mensagens_whatsapp (agendamento_id)
  WHERE tipo_mensagem = 'lembrete_2h' AND direcao = 'OUT' AND agendamento_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mensagens_whatsapp_agradecimento_unique
  ON public.mensagens_whatsapp (agendamento_id)
  WHERE tipo_mensagem = 'agradecimento' AND direcao = 'OUT' AND agendamento_id IS NOT NULL;

-- Índice para performance da função pode_enviar_outbound
CREATE INDEX IF NOT EXISTS mensagens_whatsapp_outbound_recent_idx
  ON public.mensagens_whatsapp (direcao, tipo_mensagem, created_at DESC)
  WHERE direcao = 'OUT';
