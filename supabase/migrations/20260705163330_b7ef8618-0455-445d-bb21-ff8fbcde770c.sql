
-- Seed endpoint message.received (inactive by default; admin configures URL in /admin/webhooks)
INSERT INTO public.crm_webhook_endpoints (event, url, secret, active, description)
VALUES ('message.received', '', NULL, false,
        'Disparado a cada mensagem IN de WhatsApp/Instagram vinculada a um lead. Configure a URL do n8n e ative.')
ON CONFLICT (event) DO NOTHING;

-- Trigger function: emit message.received on new IN messages
CREATE OR REPLACE FUNCTION public.trg_mensagens_whatsapp_emit_message_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_ag record;
  v_canal text;
BEGIN
  -- Only IN messages with agendamento vinculado
  IF NEW.direcao IS DISTINCT FROM 'IN' THEN
    RETURN NEW;
  END IF;
  IF NEW.agendamento_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Normalize channel from tipo_mensagem
  v_canal := CASE
    WHEN lower(coalesce(NEW.tipo_mensagem, '')) IN ('instagram', 'ig') THEN 'instagram'
    ELSE 'whatsapp'
  END;

  -- Only whatsapp/instagram conversational messages
  IF lower(coalesce(NEW.tipo_mensagem, 'whatsapp')) NOT IN (
    'whatsapp', 'instagram', 'ig', 'recebida', 'manual', 'imagem', 'audio', 'video', 'documento', 'sticker', 'reacao'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT id, telefone_whatsapp, status_crm, status_funil, bot_ativo, origem
    INTO v_ag
  FROM public.agendamentos
  WHERE id = NEW.agendamento_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  PERFORM public.crm_emit_event(
    'message.received',
    jsonb_build_object(
      'agendamento_id', NEW.agendamento_id,
      'mensagem_id', NEW.id,
      'telefone', COALESCE(NEW.telefone, v_ag.telefone_whatsapp),
      'canal', v_canal,
      'conteudo', NEW.conteudo,
      'tipo_mensagem', NEW.tipo_mensagem,
      'mensagem_externa_id', NEW.mensagem_externa_id,
      'created_at', NEW.created_at,
      'status_crm', v_ag.status_crm,
      'status_funil', v_ag.status_funil,
      'bot_ativo', COALESCE(v_ag.bot_ativo, true),
      'origem', v_ag.origem
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never break the insert if webhook emission fails
  INSERT INTO public.system_logs (level, category, source, message, details)
  VALUES ('error', 'edge_function', 'trg_mensagens_whatsapp_emit_message_received',
          'Falha ao emitir message.received: ' || SQLERRM,
          jsonb_build_object('mensagem_id', NEW.id, 'sqlstate', SQLSTATE));
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.trg_mensagens_whatsapp_emit_message_received() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_mw_emit_message_received ON public.mensagens_whatsapp;
CREATE TRIGGER trg_mw_emit_message_received
AFTER INSERT ON public.mensagens_whatsapp
FOR EACH ROW
EXECUTE FUNCTION public.trg_mensagens_whatsapp_emit_message_received();
