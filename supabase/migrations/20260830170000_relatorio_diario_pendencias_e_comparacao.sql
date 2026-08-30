-- O relatorio das 8h passa a responder "o que fazer hoje", e nao so "o que aconteceu".
--
-- O QUE ESTAVA ERRADO. O relatorio mandava tres numeros: total de mensagens, novos leads e
-- uma taxa de conversao. Nenhum deles vira decisao as 8 da manha. "Total: 15 mensagens" nao
-- muda nada no dia. "Novos leads: 2" sozinho nao diz se foi bom ou ruim.
--
-- E ele escondia o que importa. Medido em 30/08/2026: 23 leads esperando atendimento
-- humano e 34 parados ha mais de tres dias em conversa. Nada disso aparecia.
--
-- SO ACRESCENTA CHAVES, nunca remove. A tela /admin/relatorios consome esta mesma RPC, em
-- src/pages/admin/Relatorios.tsx, e le whatsapp e crm do jeito que sempre leu.
--
-- AS PENDENCIAS SAO FOTO DO AGORA, nao do periodo. Sao fila acumulada, e fila nao tem
-- recorte de data: ou tem gente esperando ou nao tem.
--
-- CANCELAMENTOS VEM DO crm_audit_log, e nao da tabela de agendamentos. O status atual so
-- diz onde a pessoa esta hoje. Para saber que ela cancelou ONTEM e preciso a mudanca de
-- status, que e o que o log guarda.
--
-- A MEDIA DE 7 DIAS existe para dar escala ao numero do dia. Um numero sozinho nao informa,
-- e comparar com a media e a leitura mais barata que resolve isso.
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
  v_precisa_humano int; v_parados int; v_aguardando int;
  v_cancelamentos int;
  v_media_leads numeric;
  v_google_nota numeric; v_google_total int; v_google_novas int;
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

  -- Fila acumulada, foto do agora.
  SELECT
    COUNT(*) FILTER (WHERE status_crm = 'PRECISA_DE_HUMANO'),
    COUNT(*) FILTER (WHERE status_funil = 'em_conversa' AND updated_at < now() - interval '3 days'),
    COUNT(*) FILTER (WHERE status_funil = 'aguardando_confirmacao')
  INTO v_precisa_humano, v_parados, v_aguardando
  FROM public.agendamentos;

  /*
    CANCELAMENTO VEM DE DUAS FONTES, e nao so do log. O crm_audit_log e o lugar certo,
    porque o status atual so diz onde a pessoa esta hoje e para saber que ela cancelou
    ONTEM e preciso a mudanca de status. So que o gatilho que alimenta o log dispara em
    AFTER UPDATE OF status_crm, e cancelar-agendamento escreve direto em status_funil sem
    passar por ele. Contar so o log daria zero num dia em que houve cancelamento.

    COUNT DISTINCT sobre a uniao das duas, para o agendamento que aparece nas duas nao
    contar duas vezes.
  */
  SELECT COUNT(DISTINCT id) INTO v_cancelamentos
  FROM (
    SELECT agendamento_id AS id
    FROM public.crm_audit_log
    WHERE created_at >= v_inicio AND created_at < v_fim
      AND status_novo IN ('CANCELADO','cancelado')
    UNION
    SELECT id
    FROM public.agendamentos
    WHERE status_funil = 'cancelado'
      AND updated_at >= v_inicio AND updated_at < v_fim
  ) t;

  /*
    MEDIA DIARIA DOS 7 DIAS ANTERIORES AO PERIODO, e a divisao e por 7 fixo.

    NAO USE AVG COM GROUP BY POR DATA. O GROUP BY so cria linha para dia que teve lead,
    entao dia com zero some da conta e o AVG divide por 4 em vez de 7. A media sai inflada e
    a seta aponta para baixo num dia perfeitamente normal, que e justamente o oposto do que
    a comparacao deveria informar.

    A janela tambem termina onde o periodo comeca, para o proprio dia do relatorio nao
    entrar na media com que ele e comparado.
  */
  SELECT ROUND(COUNT(*)::numeric / 7, 1) INTO v_media_leads
  FROM public.agendamentos
  WHERE created_at >= (p_data_inicio - 7)::timestamptz
    AND created_at <  v_inicio;

  SELECT google_rating, google_reviews_total
    INTO v_google_nota, v_google_total
  FROM public.site_config WHERE id = true;

  SELECT COUNT(*) INTO v_google_novas
  FROM public.avaliacoes_google
  WHERE created_at >= v_inicio AND created_at < v_fim;

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
      'funil_atual', v_funil,
      'cancelamentos', v_cancelamentos,
      -- Sem COALESCE: COUNT sem GROUP BY sempre devolve linha, entao a divisao por 7 nunca
      -- e NULL. O COALESCE era resto da versao com AVG.
      'media_leads_7d', v_media_leads
    ),
    'pendencias', jsonb_build_object(
      'precisa_humano', v_precisa_humano,
      'parados_3d', v_parados,
      'aguardando_confirmacao', v_aguardando
    ),
    'google', jsonb_build_object(
      'nota', v_google_nota,
      'total', v_google_total,
      'novas_no_periodo', v_google_novas
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.relatorio_diario(date, date) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.relatorio_diario(date, date) TO service_role, authenticated;
