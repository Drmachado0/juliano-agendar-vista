-- Tabela singleton para configuração da Evolution API editável pela UI
CREATE TABLE IF NOT EXISTS public.integracoes_evolution (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  base_url text NOT NULL DEFAULT '',
  instance text NOT NULL DEFAULT '',
  api_token_encrypted bytea,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.integracoes_evolution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view evolution config"
ON public.integracoes_evolution
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update evolution config"
ON public.integracoes_evolution
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert evolution config"
ON public.integracoes_evolution
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed inicial (única linha) — fica vazia até admin preencher
INSERT INTO public.integracoes_evolution (id, base_url, instance, api_token_encrypted)
VALUES (true, '', '', NULL)
ON CONFLICT (id) DO NOTHING;

-- RPC: leitura mascarada (admin only)
CREATE OR REPLACE FUNCTION public.obter_evolution_config_mascarada()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.integracoes_evolution%ROWTYPE;
  v_token text;
  v_masked text;
  v_len int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  SELECT * INTO v_row FROM public.integracoes_evolution WHERE id = true;

  IF v_row.api_token_encrypted IS NOT NULL THEN
    BEGIN
      v_token := public.decrypt_sensitive_data(v_row.api_token_encrypted);
    EXCEPTION WHEN OTHERS THEN
      v_token := NULL;
    END;
  END IF;

  v_len := COALESCE(length(v_token), 0);
  IF v_len = 0 THEN
    v_masked := '';
  ELSIF v_len <= 8 THEN
    v_masked := repeat('•', v_len);
  ELSE
    v_masked := substring(v_token from 1 for 4) || repeat('•', greatest(4, v_len - 8)) || substring(v_token from v_len - 3);
  END IF;

  RETURN jsonb_build_object(
    'base_url', COALESCE(v_row.base_url, ''),
    'instance', COALESCE(v_row.instance, ''),
    'token_masked', v_masked,
    'token_length', v_len,
    'updated_at', v_row.updated_at,
    'configured', (COALESCE(v_row.base_url,'') <> '' AND COALESCE(v_row.instance,'') <> '' AND v_len > 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.obter_evolution_config_mascarada() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_evolution_config_mascarada() TO authenticated;

-- RPC: atualizar (admin only) — campos opcionais; api_token só atualiza se fornecido
CREATE OR REPLACE FUNCTION public.atualizar_evolution_config(
  p_base_url text DEFAULT NULL,
  p_instance text DEFAULT NULL,
  p_api_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_clean_url text;
BEGIN
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  IF p_base_url IS NOT NULL THEN
    v_clean_url := regexp_replace(trim(p_base_url), '/+$', '');
    IF v_clean_url !~* '^https?://' THEN
      RAISE EXCEPTION 'base_url inválida — deve começar com http(s)://';
    END IF;
  END IF;

  IF p_instance IS NOT NULL AND length(trim(p_instance)) = 0 THEN
    RAISE EXCEPTION 'instance não pode ser vazia';
  END IF;

  IF p_api_token IS NOT NULL AND length(trim(p_api_token)) > 0 AND length(trim(p_api_token)) < 10 THEN
    RAISE EXCEPTION 'api_token muito curto (mínimo 10 chars)';
  END IF;

  UPDATE public.integracoes_evolution
  SET
    base_url = COALESCE(v_clean_url, base_url),
    instance = COALESCE(NULLIF(trim(p_instance), ''), instance),
    api_token_encrypted = CASE
      WHEN p_api_token IS NOT NULL AND length(trim(p_api_token)) > 0
        THEN public.encrypt_sensitive_data(trim(p_api_token))
      ELSE api_token_encrypted
    END,
    updated_at = now(),
    updated_by = v_user
  WHERE id = true;

  RETURN public.obter_evolution_config_mascarada();
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_evolution_config(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atualizar_evolution_config(text, text, text) TO authenticated;

-- RPC interna para edge functions (service_role): retorna config DESCRIPTOGRAFADA
CREATE OR REPLACE FUNCTION public.obter_evolution_config_interna()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.integracoes_evolution%ROWTYPE;
  v_token text;
BEGIN
  SELECT * INTO v_row FROM public.integracoes_evolution WHERE id = true;

  IF v_row.api_token_encrypted IS NOT NULL THEN
    BEGIN
      v_token := public.decrypt_sensitive_data(v_row.api_token_encrypted);
    EXCEPTION WHEN OTHERS THEN
      v_token := NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'base_url', COALESCE(v_row.base_url, ''),
    'instance', COALESCE(v_row.instance, ''),
    'token', COALESCE(v_token, '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.obter_evolution_config_interna() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_evolution_config_interna() TO service_role;