-- Correção 2026-07-13: vincular_mensagem_por_telefone deve considerar
-- "ativo" apenas quando NEM status_crm NEM status_funil estão em terminais.
-- Bug reproduzido no telefone canônico 91991300174: um lead atual "NOVO LEAD"
-- convivia com um histórico com status_crm='HGP' porém status_funil='cancelado',
-- gerando 2 ativos e resposta ambigua. Filtramos também status_funil.
-- Preserva pg_advisory_xact_lock, idempotência e retorno ambíguo (sem merge).

CREATE OR REPLACE FUNCTION public.vincular_mensagem_por_telefone(
  p_mensagem_id uuid,
  p_nome_contato text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $fn$
DECLARE
  v_tel_c text;
  v_agendamento_id uuid;
  v_count int;
  v_criado boolean := false;
  v_ambiguo boolean := false;
BEGIN
  SELECT telefone_canonico INTO v_tel_c
    FROM public.mensagens_whatsapp WHERE id = p_mensagem_id;
  IF v_tel_c IS NULL OR length(v_tel_c) < 10 THEN
    RETURN jsonb_build_object(
      'agendamento_id', NULL, 'criado', false, 'ambiguo', false,
      'total_matches', 0, 'motivo', 'telefone_invalido'
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_tel_c, 0));

  -- Ativo = não sandbox
  -- AND status_crm case-insensitive NÃO em (ATENDIDO,CANCELADO,COMPARECEU)
  -- AND status_funil case-insensitive NÃO em (cancelado,compareceu,faltou)
  SELECT count(*) INTO v_count
    FROM public.agendamentos
   WHERE telefone_canonico = v_tel_c
     AND is_sandbox IS NOT TRUE
     AND upper(coalesce(status_crm,'')) NOT IN ('ATENDIDO','CANCELADO','COMPARECEU')
     AND lower(coalesce(status_funil,'')) NOT IN ('cancelado','compareceu','faltou');

  IF v_count = 1 THEN
    SELECT id INTO v_agendamento_id
      FROM public.agendamentos
     WHERE telefone_canonico = v_tel_c
       AND is_sandbox IS NOT TRUE
       AND upper(coalesce(status_crm,'')) NOT IN ('ATENDIDO','CANCELADO','COMPARECEU')
       AND lower(coalesce(status_funil,'')) NOT IN ('cancelado','compareceu','faltou')
     LIMIT 1;
  ELSIF v_count = 0 THEN
    INSERT INTO public.agendamentos (
      nome_completo, telefone_whatsapp,
      tipo_atendimento, local_atendimento, convenio,
      status_crm, status_funil, estado_atendimento, origem
    ) VALUES (
      COALESCE(NULLIF(trim(p_nome_contato), ''), 'Lead WhatsApp'),
      v_tel_c, 'Consulta', 'A definir', 'Particular',
      'NOVO LEAD', 'novo', 'novo', 'whatsapp_inbound'
    )
    RETURNING id INTO v_agendamento_id;
    v_criado := true;
  ELSE
    v_ambiguo := true;
    v_agendamento_id := NULL;
  END IF;

  IF v_agendamento_id IS NOT NULL THEN
    UPDATE public.mensagens_whatsapp
      SET agendamento_id = v_agendamento_id
    WHERE id = p_mensagem_id AND agendamento_id IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'agendamento_id', v_agendamento_id,
    'criado', v_criado,
    'ambiguo', v_ambiguo,
    'total_matches', v_count
  );
END
$fn$;

REVOKE ALL ON FUNCTION public.vincular_mensagem_por_telefone(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_mensagem_por_telefone(uuid, text) TO service_role;