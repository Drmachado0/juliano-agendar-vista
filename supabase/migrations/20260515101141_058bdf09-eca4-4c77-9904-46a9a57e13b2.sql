
ALTER TABLE public.disponibilidade_semanal
  ADD COLUMN IF NOT EXISTS nome text;

ALTER TABLE public.disponibilidade_especifica
  ADD COLUMN IF NOT EXISTS modelo_id uuid REFERENCES public.disponibilidade_semanal(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_disp_especifica_clinica_data
  ON public.disponibilidade_especifica(clinica_id, data);

-- ============================================================
-- get_available_slots(data, clínica)
-- ============================================================
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
  -- Sem disp_especifica ativa para esta clínica/data → dia fechado.
  SELECT * INTO v_disp
  FROM public.disponibilidade_especifica de
  WHERE de.clinica_id = p_clinica_id
    AND de.data = p_data
    AND de.disponivel = true
  ORDER BY de.created_at DESC
  LIMIT 1;

  IF v_disp IS NULL THEN
    RETURN;
  END IF;

  -- Resolve hora_inicio/fim/intervalo: campos próprios > modelo
  v_hora_inicio := v_disp.hora_inicio;
  v_hora_fim := v_disp.hora_fim;
  v_intervalo := v_disp.intervalo_minutos;

  IF (v_hora_inicio IS NULL OR v_hora_fim IS NULL OR v_intervalo IS NULL) AND v_disp.modelo_id IS NOT NULL THEN
    SELECT * INTO v_modelo
    FROM public.disponibilidade_semanal ds
    WHERE ds.id = v_disp.modelo_id;
    IF v_modelo IS NOT NULL THEN
      v_hora_inicio := COALESCE(v_hora_inicio, v_modelo.hora_inicio);
      v_hora_fim := COALESCE(v_hora_fim, v_modelo.hora_fim);
      v_intervalo := COALESCE(v_intervalo, v_modelo.intervalo_minutos);
    END IF;
  END IF;

  IF v_hora_inicio IS NULL OR v_hora_fim IS NULL THEN
    RETURN;
  END IF;
  v_intervalo := COALESCE(v_intervalo, 30);

  -- "agora" em America/Belem (UTC-3 fixo)
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
      -- passado?
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

-- ============================================================
-- get_available_days(mês, ano, clínica)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_available_days(
  p_month int,
  p_year int,
  p_clinica_id uuid
)
RETURNS TABLE(data date, total_slots int, slots_livres int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first date;
  v_last date;
  v_today date;
  r record;
BEGIN
  v_first := make_date(p_year, p_month, 1);
  v_last := (v_first + interval '1 month' - interval '1 day')::date;
  v_today := ((now() AT TIME ZONE 'America/Belem')::date);

  FOR r IN
    SELECT DISTINCT de.data
    FROM public.disponibilidade_especifica de
    WHERE de.clinica_id = p_clinica_id
      AND de.disponivel = true
      AND de.data BETWEEN GREATEST(v_first, v_today) AND v_last
    ORDER BY de.data
  LOOP
    SELECT
      COUNT(*)::int,
      COUNT(*) FILTER (WHERE s.status = 'livre')::int
    INTO total_slots, slots_livres
    FROM public.get_available_slots(r.data, p_clinica_id) s;

    IF COALESCE(total_slots, 0) > 0 THEN
      data := r.data;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_days(int, int, uuid) TO anon, authenticated;

-- ============================================================
-- get_next_available_slot(clínica)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_next_available_slot(
  p_clinica_id uuid,
  p_from date DEFAULT NULL
)
RETURNS TABLE(data date, hora time)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date;
  r record;
  s record;
BEGIN
  v_from := COALESCE(p_from, ((now() AT TIME ZONE 'America/Belem')::date));

  FOR r IN
    SELECT de.data
    FROM public.disponibilidade_especifica de
    WHERE de.clinica_id = p_clinica_id
      AND de.disponivel = true
      AND de.data >= v_from
    ORDER BY de.data
    LIMIT 90
  LOOP
    FOR s IN SELECT * FROM public.get_available_slots(r.data, p_clinica_id) LOOP
      IF s.status = 'livre' THEN
        data := r.data;
        hora := s.hora;
        RETURN NEXT;
        RETURN;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_available_slot(uuid, date) TO anon, authenticated;
