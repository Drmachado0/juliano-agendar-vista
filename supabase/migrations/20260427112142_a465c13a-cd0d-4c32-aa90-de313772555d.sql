-- Expande allowlist de tipos legados já em uso
CREATE OR REPLACE FUNCTION public.registrar_mensagem_whatsapp(
  p_telefone text,
  p_direcao text,
  p_conteudo text,
  p_tipo_mensagem text DEFAULT 'manual',
  p_agendamento_id uuid DEFAULT NULL,
  p_status_envio text DEFAULT 'enviado',
  p_mensagem_externa_id text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_payload jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_agendamento_id uuid := p_agendamento_id;
  v_norm text;
  v_last8 text;
  v_tipos_validos text[] := ARRAY[
    'manual','confirmacao','confirmacao_automatica','lembrete_24h','boas_vindas',
    'bot_pre_agendamento','avaliacao','lembrete_anual','sistema',
    'recebida','imagem','audio','video','documento','sticker','reacao',
    'resposta_automatica'
  ];
  v_tipo text := COALESCE(NULLIF(p_tipo_mensagem,''),'manual');
  v_status text := COALESCE(NULLIF(p_status_envio,''),'enviado');
BEGIN
  IF p_telefone IS NULL OR length(trim(p_telefone)) = 0 THEN
    RAISE EXCEPTION 'telefone obrigatório';
  END IF;
  IF p_direcao NOT IN ('IN','OUT') THEN
    RAISE EXCEPTION 'direcao deve ser IN ou OUT';
  END IF;
  IF p_conteudo IS NULL THEN
    RAISE EXCEPTION 'conteudo obrigatório';
  END IF;

  IF NOT (v_tipo = ANY(v_tipos_validos)) THEN
    v_tipo := 'sistema';
  END IF;

  IF v_agendamento_id IS NULL THEN
    v_norm := public.normalizar_telefone(p_telefone);
    IF v_norm IS NOT NULL AND length(v_norm) >= 8 THEN
      v_last8 := right(v_norm, 8);
      SELECT a.id INTO v_agendamento_id
      FROM public.agendamentos a
      WHERE public.normalizar_telefone(a.telefone_whatsapp) ILIKE '%' || v_last8
      ORDER BY
        a.is_sandbox ASC,
        (a.data_agendamento IS NOT NULL) DESC,
        a.created_at DESC
      LIMIT 1;
    END IF;
  END IF;

  INSERT INTO public.mensagens_whatsapp (
    agendamento_id, telefone, direcao, conteudo,
    tipo_mensagem, status_envio, mensagem_externa_id, error_message, payload
  ) VALUES (
    v_agendamento_id, p_telefone, p_direcao, p_conteudo,
    v_tipo, v_status, p_mensagem_externa_id, p_error_message, p_payload
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_mensagem_whatsapp(text,text,text,text,uuid,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_mensagem_whatsapp(text,text,text,text,uuid,text,text,text,jsonb) TO authenticated, service_role;