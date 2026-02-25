
-- 1. Criar função registrar_mensagem (chamada pelo n8n via RPC)
CREATE OR REPLACE FUNCTION public.registrar_mensagem(
  p_phone_number TEXT,
  p_remote_jid TEXT DEFAULT NULL,
  p_nome TEXT DEFAULT 'Paciente',
  p_conteudo TEXT DEFAULT '',
  p_direcao TEXT DEFAULT 'entrada',
  p_tipo_mensagem TEXT DEFAULT 'texto',
  p_message_id TEXT DEFAULT '',
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  v_agendamento_id UUID;
  v_telefone_formatado TEXT;
  v_direcao_db TEXT;
  v_mensagem_id UUID;
  v_last8 TEXT;
BEGIN
  v_direcao_db := CASE 
    WHEN p_direcao = 'entrada' THEN 'IN'
    WHEN p_direcao = 'saida' THEN 'OUT'
    ELSE p_direcao
  END;

  v_last8 := RIGHT(regexp_replace(p_phone_number, '\D', '', 'g'), 8);

  SELECT id, telefone_whatsapp INTO v_agendamento_id, v_telefone_formatado
  FROM agendamentos
  WHERE RIGHT(regexp_replace(telefone_whatsapp, '\D', '', 'g'), 8) = v_last8
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO mensagens_whatsapp (
    agendamento_id, telefone, direcao, conteudo,
    status_envio, mensagem_externa_id, lida
  ) VALUES (
    v_agendamento_id,
    COALESCE(v_telefone_formatado, p_phone_number),
    v_direcao_db,
    p_conteudo,
    CASE WHEN v_direcao_db = 'OUT' THEN 'enviado' ELSE NULL END,
    NULLIF(p_message_id, ''),
    CASE WHEN v_direcao_db = 'IN' THEN false ELSE true END
  ) RETURNING id INTO v_mensagem_id;

  RETURN jsonb_build_object(
    'success', true,
    'mensagem_id', v_mensagem_id,
    'agendamento_id', v_agendamento_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar view pacientes (consultada pelo n8n para buscar dados do paciente)
CREATE OR REPLACE VIEW public.pacientes AS
SELECT
  a.id,
  regexp_replace(a.telefone_whatsapp, '\D', '', 'g') AS phone_number,
  a.nome_completo AS nome,
  a.convenio,
  a.tipo_atendimento AS tags,
  COALESCE(msg_count.total, 0) AS total_mensagens,
  COALESCE(ag_count.total, 0) AS total_atendimentos
FROM agendamentos a
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INT AS total
  FROM mensagens_whatsapp m
  WHERE m.agendamento_id = a.id
) msg_count ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INT AS total
  FROM agendamentos a2
  WHERE RIGHT(regexp_replace(a2.telefone_whatsapp, '\D', '', 'g'), 8) 
      = RIGHT(regexp_replace(a.telefone_whatsapp, '\D', '', 'g'), 8)
) ag_count ON true;

-- 3. Permitir que o role anon consulte a view (n8n usa apikey/anon)
GRANT SELECT ON public.pacientes TO anon;
GRANT SELECT ON public.pacientes TO authenticated;
