
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_data date,
  p_clinica_id uuid
)
RETURNS TABLE(hora time, status text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_disp record;
  v_modelo record;
  v_hora_inicio time;
  v_hora_fim time;
  v_intervalo int;
  v_cur time;
  v_now_belem timestamp;
  v_today_belem date;
  v_minutes_now int;
BEGIN
  SELECT * INTO v_disp
  FROM public.disponibilidade_especifica de
  WHERE de.clinica_id = p_clinica_id
    AND de.data = p_data
    AND de.disponivel = true
  ORDER BY de.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_hora_inicio := v_disp.hora_inicio;
  v_hora_fim := v_disp.hora_fim;
  v_intervalo := v_disp.intervalo_minutos;

  IF (v_hora_inicio IS NULL OR v_hora_fim IS NULL OR v_intervalo IS NULL) AND v_disp.modelo_id IS NOT NULL THEN
    SELECT * INTO v_modelo
    FROM public.disponibilidade_semanal ds
    WHERE ds.id = v_disp.modelo_id;
    IF FOUND THEN
      v_hora_inicio := COALESCE(v_hora_inicio, v_modelo.hora_inicio);
      v_hora_fim := COALESCE(v_hora_fim, v_modelo.hora_fim);
      v_intervalo := COALESCE(v_intervalo, v_modelo.intervalo_minutos);
    END IF;
  END IF;

  IF v_hora_inicio IS NULL OR v_hora_fim IS NULL THEN
    RETURN;
  END IF;
  v_intervalo := COALESCE(v_intervalo, 30);

  v_now_belem := (now() AT TIME ZONE 'America/Belem');
  v_today_belem := v_now_belem::date;
  v_minutes_now := EXTRACT(HOUR FROM v_now_belem)::int * 60
                 + EXTRACT(MINUTE FROM v_now_belem)::int;

  v_cur := v_hora_inicio;
  WHILE v_cur < v_hora_fim LOOP
    DECLARE
      v_status text := 'livre';
      v_slot_minutes int := EXTRACT(HOUR FROM v_cur)::int * 60
                          + EXTRACT(MINUTE FROM v_cur)::int;
      v_blocked boolean;
      v_taken boolean;
    BEGIN
      IF p_data < v_today_belem
         OR (p_data = v_today_belem AND v_slot_minutes <= v_minutes_now) THEN
        v_status := 'bloqueado';
      ELSE
        SELECT EXISTS (
          SELECT 1 FROM public.bloqueios_agenda b
          WHERE b.clinica_id = p_clinica_id
            AND b.data = p_data
            AND (
              b.tipo_bloqueio IN ('dia_inteiro','feriado')
              OR (
                b.tipo_bloqueio = 'intervalo'
                AND b.hora_inicio IS NOT NULL AND b.hora_fim IS NOT NULL
                AND v_cur >= b.hora_inicio AND v_cur < b.hora_fim
              )
            )
        ) INTO v_blocked;

        IF v_blocked THEN
          v_status := 'bloqueado';
        ELSE
          SELECT EXISTS (
            SELECT 1 FROM public.agendamentos a
            WHERE a.clinica_id = p_clinica_id
              AND a.data_agendamento = p_data
              AND a.hora_agendamento = v_cur
              AND COALESCE(a.status_crm,'') <> 'cancelado'
          ) INTO v_taken;
          IF v_taken THEN v_status := 'ocupado'; END IF;
        END IF;
      END IF;

      hora := v_cur;
      status := v_status;
      RETURN NEXT;
    END;
    v_cur := v_cur + (v_intervalo * interval '1 minute');
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_slots(date, uuid) TO anon, authenticated;
