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
    RETURN true; -- telefone invalido, deixa logica de envio rejeitar
  END IF;

  SELECT count(*) INTO v_count
  FROM public.mensagens_whatsapp
  WHERE direcao = 'OUT'
    AND (p_tipo IS NULL OR tipo_mensagem = p_tipo)
    AND created_at > now() - make_interval(mins => p_janela_minutos)
    -- NULL continua contando: registro antigo, sem status, e tratado como enviado.
    AND coalesce(status_envio, '') <> 'erro'
    AND right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 8) = v_last8;

  RETURN v_count < p_max_msgs;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pode_enviar_outbound(text, text, integer, integer) TO authenticated, service_role;