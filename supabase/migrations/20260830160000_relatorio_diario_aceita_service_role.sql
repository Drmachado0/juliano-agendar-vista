-- relatorio_diario e relatorio_diario_serie passam a aceitar service_role.
--
-- O ULTIMO ELO DE UMA CORRENTE DE TRES. Depois de consertar a autenticacao do
-- cron e a da edge function, o relatorio diario ainda morria, agora com
-- "Access denied: admin role required" e HTTP 500.
--
-- A causa: as duas RPCs guardam com has_role(auth.uid(), 'admin'). A edge
-- function chama com a service role key, onde auth.uid() e NULL, entao
-- has_role(NULL, 'admin') e falso e a excecao sobe. Era invisivel enquanto o
-- cron nem chegava ate aqui.
--
-- E O PADRAO DA CASA. ler_secret_integracao ja libera service_role pelo mesmo
-- motivo, e nao afrouxa nada de verdade: quem tem a service role key ja passa
-- por cima de toda a RLS do banco. O acesso de admin continua valendo, entao a
-- tela do dashboard nao muda.
--
-- AS FUNCOES SAO REESCRITAS INTEIRAS, e nao remendadas. A primeira versao desta
-- migracao pegava pg_get_functiondef e trocava a linha da guarda por replace().
-- Duas coisas ruins nisso: a guarda de uma funcao que le mensagens_whatsapp
-- ficava invisivel na revisao, que so via um replace, e o resultado passava a
-- depender do estado do banco alvo, entao producao e um db reset podiam divergir
-- em silencio. Reescrever e o que as migracoes 20260429022326 e 20260429021807
-- ja faziam com estas mesmas funcoes.

-- Um nome para o predicado, em vez de uma terceira forma dele. ler_secret_integracao
-- escreve "v_role IS DISTINCT FROM 'service_role'" no corpo dela, e sem isto aqui
-- as duas funcoes abaixo ganhariam mais duas variacoes, escondidas dentro dos
-- corpos onde nenhum grep nas migracoes encontra.
CREATE OR REPLACE FUNCTION public.eh_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT coalesce(
           current_setting('request.jwt.claims', true)::jsonb ->> 'role',
           ''
         ) = 'service_role'
$$;

COMMENT ON FUNCTION public.eh_service_role() IS
  'True quando a chamada vem com a service role key. Use para liberar RPC de admin para edge function e cron.';

CREATE OR REPLACE FUNCTION public.relatorio_diario(
  p_data_inicio date DEFAULT ((CURRENT_DATE - '6 days'::interval))::date,
  p_data_fim date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_msg_in int; v_msg_out int;
  v_msg_por_tipo jsonb;
  v_leads_novos int; v_conversoes int;
  v_funil jsonb;
  v_inicio timestamptz := p_data_inicio::timestamptz;
  v_fim timestamptz := (p_data_fim + 1)::timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.eh_service_role()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE direcao='IN'),
    COUNT(*) FILTER (WHERE direcao='OUT')
  INTO v_msg_in, v_msg_out
  FROM public.mensagens_whatsapp
  WHERE created_at >= v_inicio AND created_at < v_fim;

  SELECT COALESCE(jsonb_object_agg(tipo_mensagem, qtd), '{}'::jsonb) INTO v_msg_por_tipo
  FROM (
    SELECT COALESCE(tipo_mensagem,'(none)') AS tipo_mensagem, COUNT(*) AS qtd
    FROM public.mensagens_whatsapp
    WHERE created_at >= v_inicio AND created_at < v_fim
    GROUP BY tipo_mensagem
  ) t;

  SELECT COUNT(*) INTO v_leads_novos
  FROM public.agendamentos
  WHERE created_at >= v_inicio AND created_at < v_fim;

  SELECT COUNT(*) INTO v_conversoes
  FROM public.crm_audit_log
  WHERE created_at >= v_inicio AND created_at < v_fim
    AND status_novo IN ('CLINICOR','HGP','agendado');

  SELECT COALESCE(jsonb_object_agg(status, qtd), '{}'::jsonb) INTO v_funil
  FROM (
    SELECT COALESCE(status_funil,'(none)') AS status, COUNT(*) AS qtd
    FROM public.agendamentos
    GROUP BY status_funil
  ) t;

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
    'gerado_em', now(),
    'whatsapp', jsonb_build_object(
      'mensagens_in', v_msg_in,
      'mensagens_out', v_msg_out,
      'total', v_msg_in + v_msg_out,
      'por_tipo', v_msg_por_tipo
    ),
    'crm', jsonb_build_object(
      'leads_novos', v_leads_novos,
      'conversoes', v_conversoes,
      'funil_atual', v_funil
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.relatorio_diario_serie(
  p_data_inicio date DEFAULT (CURRENT_DATE - interval '13 days')::date,
  p_data_fim date DEFAULT CURRENT_DATE
)
RETURNS TABLE(dia date, msg_in bigint, msg_out bigint, leads_novos bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.eh_service_role()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  WITH dias AS (
    SELECT generate_series(p_data_inicio, p_data_fim, interval '1 day')::date AS d
  )
  SELECT
    dias.d,
    COALESCE((SELECT COUNT(*) FROM public.mensagens_whatsapp m WHERE m.created_at::date = dias.d AND m.direcao='IN'),0),
    COALESCE((SELECT COUNT(*) FROM public.mensagens_whatsapp m WHERE m.created_at::date = dias.d AND m.direcao='OUT'),0),
    COALESCE((SELECT COUNT(*) FROM public.agendamentos a WHERE a.created_at::date = dias.d),0)
  FROM dias
  ORDER BY dias.d ASC;
END;
$function$;

-- Liberar a guarda por dentro nao basta: sem o GRANT, o EXECUTE fica dependendo
-- do ALTER DEFAULT PRIVILEGES do bootstrap do Supabase, que este repositorio
-- nunca declara. O padrao da casa e revogar de PUBLIC e conceder explicitamente
-- ao service_role, como fazem ler_secret_integracao e arquivar_agendamentos_antigos.
REVOKE EXECUTE ON FUNCTION public.relatorio_diario(date, date) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.relatorio_diario_serie(date, date) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.relatorio_diario(date, date) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.relatorio_diario_serie(date, date) TO service_role, authenticated;

-- O destino do relatorio NAO e semeado aqui. A linha RELATORIO_DIARIO_DESTINO
-- nao e criada por migracao nenhuma e nao ha seed.sql, entao um UPDATE aqui
-- afetaria zero linhas em qualquer ambiente que nao seja producao, prometendo
-- algo que nao entrega. Em producao o valor ja foi gravado em 30/08/2026.
--
-- Se um dia valer um padrao de codigo, TELEFONE_NOTIFICACAO_INTERNA ja existe em
-- _shared/yagLeadMensagens.ts e serviria de fallback em enviar-relatorio-diario.
