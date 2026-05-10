CREATE OR REPLACE FUNCTION public.crm_emit_event(p_event text, p_body jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
    RETURN NULL;
  END IF;

  IF v_endpoint.url IS NULL OR btrim(v_endpoint.url) = '' OR v_endpoint.url !~* '^https?://' THEN
    RAISE NOTICE 'crm_emit_event: skipping event % - URL not configured', p_event;
    RETURN NULL;
  END IF;

  v_headers := jsonb_build_object('Content-Type', 'application/json');
  IF v_endpoint.secret IS NOT NULL AND btrim(v_endpoint.secret) <> '' THEN
    v_headers := v_headers || jsonb_build_object('X-Webhook-Secret', v_endpoint.secret);
  END IF;

  SELECT net.http_post(
    url := v_endpoint.url,
    headers := v_headers,
    body := jsonb_build_object('event', p_event, 'data', p_body, 'ts', now())
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;