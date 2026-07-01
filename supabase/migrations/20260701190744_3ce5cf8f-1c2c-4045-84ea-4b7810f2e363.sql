
-- Tabela de segredos de integração (rotacionáveis pelo painel admin)
CREATE TABLE IF NOT EXISTS public.integracao_secrets (
  nome text PRIMARY KEY,
  valor_encrypted bytea NOT NULL,
  versao integer NOT NULL DEFAULT 1,
  rotacionado_em timestamptz NOT NULL DEFAULT now(),
  rotacionado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rotacionado_por_email text
);

-- Nenhum GRANT para authenticated/anon: só service_role acessa via edge functions.
GRANT ALL ON public.integracao_secrets TO service_role;

ALTER TABLE public.integracao_secrets ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy p/ authenticated → nenhum SELECT/INSERT direto do frontend.
-- Todo acesso deve passar pelas RPCs abaixo.

-- ============================================================================
-- ROTATE: gera novo valor aleatório, criptografa e retorna em claro UMA vez.
-- Só admin pode chamar.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rotacionar_secret_integracao(p_nome text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_novo_valor text;
  v_versao_anterior int;
  v_versao_nova int;
  v_email text;
  v_agora timestamptz := now();
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF p_nome IS NULL OR btrim(p_nome) = '' THEN
    RAISE EXCEPTION 'nome do segredo é obrigatório';
  END IF;

  -- Chave de criptografia (mesmo mecanismo do resto do sistema)
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'ENCRYPTION_KEY'
  LIMIT 1;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'ENCRYPTION_KEY não encontrada no vault';
  END IF;

  -- Gera 48 bytes aleatórios em base64 url-safe (sem padding)
  v_novo_valor := translate(encode(gen_random_bytes(48), 'base64'), '+/=', '-_');
  v_novo_valor := replace(v_novo_valor, E'\n', '');

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT versao INTO v_versao_anterior
  FROM public.integracao_secrets
  WHERE nome = p_nome;

  v_versao_nova := COALESCE(v_versao_anterior, 0) + 1;

  INSERT INTO public.integracao_secrets AS s (
    nome, valor_encrypted, versao, rotacionado_em, rotacionado_por, rotacionado_por_email
  ) VALUES (
    p_nome,
    pgp_sym_encrypt(v_novo_valor, v_key),
    v_versao_nova,
    v_agora,
    auth.uid(),
    v_email
  )
  ON CONFLICT (nome) DO UPDATE
  SET valor_encrypted        = EXCLUDED.valor_encrypted,
      versao                 = EXCLUDED.versao,
      rotacionado_em         = EXCLUDED.rotacionado_em,
      rotacionado_por        = EXCLUDED.rotacionado_por,
      rotacionado_por_email  = EXCLUDED.rotacionado_por_email;

  -- Auditoria (sem valor)
  INSERT INTO public.system_logs (level, category, source, message, details, user_id, user_email)
  VALUES (
    'warn', 'security', 'integracao_secret_rotation',
    'Segredo de integração rotacionado: ' || p_nome,
    jsonb_build_object(
      'nome', p_nome,
      'versao_anterior', v_versao_anterior,
      'versao_nova', v_versao_nova,
      'rotacionado_em', v_agora
    ),
    auth.uid(), v_email
  );

  RETURN jsonb_build_object(
    'nome', p_nome,
    'valor', v_novo_valor,
    'versao', v_versao_nova,
    'rotacionado_em', v_agora,
    'rotacionado_por_email', v_email
  );
END;
$$;

-- ============================================================================
-- READ: usado internamente por edge functions (service_role).
-- Retorna o valor em claro. Bloqueado para chamadores anon/authenticated.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ler_secret_integracao(p_nome text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_enc bytea;
  v_role text;
BEGIN
  -- Apenas service_role (edge functions) pode ler. Frontend não deve chamar.
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
  IF v_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied: service_role required';
  END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'ENCRYPTION_KEY'
  LIMIT 1;
  IF v_key IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT valor_encrypted INTO v_enc
  FROM public.integracao_secrets
  WHERE nome = p_nome;

  IF v_enc IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN pgp_sym_decrypt(v_enc, v_key);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- ============================================================================
-- INFO: metadados seguros (sem valor). Admin pode ver no painel.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.info_secret_integracao(p_nome text)
RETURNS TABLE(
  nome text,
  versao integer,
  rotacionado_em timestamptz,
  rotacionado_por_email text,
  existe boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT s.nome, s.versao, s.rotacionado_em, s.rotacionado_por_email, true
  FROM public.integracao_secrets s
  WHERE s.nome = p_nome
  UNION ALL
  SELECT p_nome, NULL::int, NULL::timestamptz, NULL::text, false
  WHERE NOT EXISTS (SELECT 1 FROM public.integracao_secrets WHERE nome = p_nome)
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.rotacionar_secret_integracao(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotacionar_secret_integracao(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.ler_secret_integracao(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ler_secret_integracao(text) TO service_role;

REVOKE ALL ON FUNCTION public.info_secret_integracao(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.info_secret_integracao(text) TO authenticated, service_role;
