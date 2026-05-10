CREATE OR REPLACE FUNCTION public.crm_ingest_lead(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel_raw   text;
  v_tel_norm  text;
  v_nome      text;
  v_data      date;
  v_hora      time;
  v_clinica   uuid;
  v_existente uuid;
  v_agend_id  uuid;
  v_msg_id    uuid;
  v_msg       text;
  v_meta      jsonb;
  v_utm       jsonb;
  v_criado    boolean := true;
BEGIN
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'payload inválido: deve ser objeto JSON';
  END IF;

  v_tel_raw := payload->>'telefone_whatsapp';
  IF v_tel_raw IS NULL OR length(regexp_replace(v_tel_raw,'\D','','g')) < 10 THEN
    RAISE EXCEPTION 'telefone_whatsapp ausente ou inválido (recebido: %)', v_tel_raw;
  END IF;

  BEGIN
    v_tel_norm := public.normalizar_telefone(v_tel_raw);
  EXCEPTION WHEN undefined_function THEN
    v_tel_norm := regexp_replace(v_tel_raw,'\D','','g');
  END;

  v_nome    := nullif(trim(coalesce(payload->>'nome_completo','')), '');
  IF v_nome IS NULL THEN v_nome := 'Lead Externo'; END IF;

  v_data    := nullif(payload->>'data_agendamento','')::date;
  v_hora    := nullif(payload->>'hora_agendamento','')::time;
  v_clinica := nullif(payload->>'clinica_id','')::uuid;

  v_msg     := nullif(payload->>'mensagem_inicial','');
  v_meta    := coalesce(payload->'metadata_msg', '{}'::jsonb);
  v_utm     := coalesce(payload->'utm', '{}'::jsonb);

  IF v_data IS NOT NULL AND v_hora IS NOT NULL AND v_clinica IS NOT NULL THEN
    SELECT id INTO v_existente
      FROM public.agendamentos
     WHERE telefone_whatsapp = v_tel_norm
       AND data_agendamento  = v_data
       AND hora_agendamento  = v_hora
       AND clinica_id        = v_clinica
       AND status_crm <> 'cancelado'
     LIMIT 1;
  END IF;

  IF v_existente IS NOT NULL THEN
    v_agend_id := v_existente;
    v_criado   := false;
  ELSE
    INSERT INTO public.agendamentos (
      nome_completo, telefone_whatsapp, email, data_nascimento,
      tipo_atendimento, detalhe_exame_ou_cirurgia,
      local_atendimento, convenio, convenio_outro,
      data_agendamento, hora_agendamento,
      aceita_primeiro_horario, aceita_contato_whatsapp_email,
      status_crm, origem,
      clinica_id, profissional_id, servico_id,
      is_sandbox,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      gclid, fbclid, gbraid, wbraid, fbp, fbc,
      landing_page, referrer
    ) VALUES (
      v_nome,
      v_tel_norm,
      nullif(payload->>'email',''),
      nullif(payload->>'data_nascimento','')::date,
      coalesce(nullif(payload->>'tipo_atendimento',''), 'consulta'),
      nullif(payload->>'detalhe_exame_ou_cirurgia',''),
      coalesce(nullif(payload->>'local_atendimento',''), 'A definir'),
      coalesce(nullif(payload->>'convenio',''), 'Particular'),
      nullif(payload->>'convenio_outro',''),
      v_data, v_hora,
      coalesce((payload->>'aceita_primeiro_horario')::boolean, false),
      coalesce((payload->>'aceita_contato_whatsapp_email')::boolean, true),
      coalesce(nullif(payload->>'status_crm',''), 'NOVO LEAD'),
      coalesce(nullif(payload->>'origem',''), 'externo'),
      v_clinica,
      nullif(payload->>'profissional_id','')::uuid,
      nullif(payload->>'servico_id','')::uuid,
      coalesce((payload->>'is_sandbox')::boolean, false),
      v_utm->>'source', v_utm->>'medium', v_utm->>'campaign', v_utm->>'term', v_utm->>'content',
      payload->>'gclid', payload->>'fbclid', payload->>'gbraid', payload->>'wbraid',
      payload->>'fbp', payload->>'fbc',
      payload->>'landing_page', payload->>'referrer'
    )
    RETURNING id INTO v_agend_id;
  END IF;

  IF v_msg IS NOT NULL THEN
    BEGIN
      v_msg_id := public.registrar_mensagem_whatsapp(
        p_telefone           := v_tel_norm,
        p_direcao            := 'IN',
        p_conteudo           := v_msg,
        p_tipo_mensagem      := coalesce(payload->>'tipo_mensagem','recebida'),
        p_agendamento_id     := v_agend_id,
        p_status_envio       := 'recebida',
        p_mensagem_externa_id:= payload->>'mensagem_externa_id',
        p_error_message      := NULL,
        p_payload            := v_meta
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.mensagens_whatsapp (
        agendamento_id, telefone, direcao, conteudo, tipo_mensagem, status_envio, payload
      ) VALUES (
        v_agend_id, v_tel_norm, 'IN', v_msg,
        'recebida', 'recebida', v_meta
      ) RETURNING id INTO v_msg_id;
    END;
  END IF;

  BEGIN
    INSERT INTO public.crm_audit_log (agendamento_id, acao, status_novo, detalhes)
    VALUES (
      v_agend_id,
      CASE WHEN v_criado THEN 'lead_ingest_n8n' ELSE 'lead_reaproveitado_n8n' END,
      coalesce(payload->>'status_crm','NOVO LEAD'),
      jsonb_build_object('payload', payload)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'agendamento_id', v_agend_id,
    'mensagem_id',    v_msg_id,
    'criado',         v_criado,
    'criado_em',      now()
  );
END;
$$;