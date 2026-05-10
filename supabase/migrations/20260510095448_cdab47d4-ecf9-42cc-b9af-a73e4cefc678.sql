CREATE OR REPLACE FUNCTION public.crm_emit_event(p_event text, p_body jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_endpoint record;
  v_request_id bigint;
  v_headers jsonb;
BEGIN
  SELECT * INTO v_endpoint
  FROM public.crm_webhook_endpoints
  WHERE event = p_event AND active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE NOTICE 'crm_emit_event: no active endpoint for event %', p_event;
    INSERT INTO public.system_logs (level, category, source, message, details)
    VALUES ('warn', 'edge_function', 'crm_emit_event',
            'Evento ignorado: nenhum endpoint ativo configurado',
            jsonb_build_object('event', p_event, 'reason', 'no_active_endpoint', 'body', p_body));
    RETURN NULL;
  END IF;

  IF v_endpoint.url IS NULL OR btrim(v_endpoint.url) = '' OR v_endpoint.url !~* '^https?://' THEN
    RAISE NOTICE 'crm_emit_event: skipping event % - invalid URL %', p_event, COALESCE(v_endpoint.url, '<null>');
    INSERT INTO public.system_logs (level, category, source, message, details)
    VALUES ('warn', 'edge_function', 'crm_emit_event',
            'Evento ignorado: URL vazia ou inválida',
            jsonb_build_object(
              'event', p_event,
              'reason', 'invalid_url',
              'url', v_endpoint.url,
              'active', v_endpoint.active,
              'body', p_body
            ));
    RETURN NULL;
  END IF;

  v_headers := jsonb_build_object('Content-Type', 'application/json');
  IF v_endpoint.secret IS NOT NULL AND btrim(v_endpoint.secret) <> '' THEN
    v_headers := v_headers || jsonb_build_object('X-Webhook-Secret', v_endpoint.secret);
  END IF;

  BEGIN
    SELECT net.http_post(
      url := v_endpoint.url,
      headers := v_headers,
      body := jsonb_build_object('event', p_event, 'data', p_body, 'ts', now())
    ) INTO v_request_id;

    INSERT INTO public.system_logs (level, category, source, message, details, request_id)
    VALUES ('info', 'edge_function', 'crm_emit_event',
            'Webhook disparado',
            jsonb_build_object(
              'event', p_event,
              'url', v_endpoint.url,
              'has_secret', (v_endpoint.secret IS NOT NULL AND btrim(v_endpoint.secret) <> ''),
              'body', p_body
            ),
            v_request_id::text);

    RETURN v_request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'crm_emit_event: http_post failed for event %: %', p_event, SQLERRM;
    INSERT INTO public.system_logs (level, category, source, message, details)
    VALUES ('error', 'edge_function', 'crm_emit_event',
            'Falha ao disparar webhook: ' || SQLERRM,
            jsonb_build_object(
              'event', p_event,
              'reason', 'http_post_exception',
              'url', v_endpoint.url,
              'sqlstate', SQLSTATE,
              'body', p_body
            ));
    RETURN NULL;
  END;
END;
$function$;