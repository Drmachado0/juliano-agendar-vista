
-- 1) Tabela
CREATE TABLE public.janelas_atendimento_lembretes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_referencia int NOT NULL,
  mes_referencia int NOT NULL CHECK (mes_referencia BETWEEN 1 AND 12),
  numero_janela int NOT NULL CHECK (numero_janela IN (1, 2)),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  data_envio_sugerida date NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ano_referencia, mes_referencia, numero_janela)
);

CREATE INDEX idx_janelas_atend_mes ON public.janelas_atendimento_lembretes (ano_referencia, mes_referencia);

ALTER TABLE public.janelas_atendimento_lembretes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage janelas_atendimento_lembretes"
  ON public.janelas_atendimento_lembretes
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger validação
CREATE OR REPLACE FUNCTION public.validar_janela_atendimento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.data_inicio > NEW.data_fim THEN
    RAISE EXCEPTION 'data_inicio (%) deve ser <= data_fim (%)', NEW.data_inicio, NEW.data_fim;
  END IF;
  IF NEW.data_envio_sugerida < NEW.data_inicio OR NEW.data_envio_sugerida > NEW.data_fim THEN
    -- permitido enviar antes da janela: validamos só se dentro? Spec diz data_envio_sugerida; permita também ANTES da janela.
    -- Apenas exigimos não estar depois do fim:
    IF NEW.data_envio_sugerida > NEW.data_fim THEN
      RAISE EXCEPTION 'data_envio_sugerida (%) não pode ser depois de data_fim (%)', NEW.data_envio_sugerida, NEW.data_fim;
    END IF;
  END IF;
  IF EXTRACT(MONTH FROM NEW.data_inicio)::int <> NEW.mes_referencia
     OR EXTRACT(YEAR FROM NEW.data_inicio)::int <> NEW.ano_referencia THEN
    RAISE EXCEPTION 'data_inicio deve estar no mês/ano de referência';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_janela_atendimento
  BEFORE INSERT OR UPDATE ON public.janelas_atendimento_lembretes
  FOR EACH ROW EXECUTE FUNCTION public.validar_janela_atendimento();

-- 2) Coluna em lembretes_campanha_remessas
ALTER TABLE public.lembretes_campanha_remessas
  ADD COLUMN janela_atendimento_id uuid REFERENCES public.janelas_atendimento_lembretes(id) ON DELETE SET NULL;

CREATE INDEX idx_remessas_janela ON public.lembretes_campanha_remessas (janela_atendimento_id);

-- 3) View status por janela (mês corrente)
CREATE OR REPLACE VIEW public.vw_status_janelas_atual AS
WITH camp AS (
  SELECT *
  FROM public.lembretes_campanhas
  WHERE ano_referencia = EXTRACT(YEAR FROM CURRENT_DATE)::int
    AND mes_referencia = EXTRACT(MONTH FROM CURRENT_DATE)::int
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT
  j.id                       AS janela_id,
  j.ano_referencia,
  j.mes_referencia,
  j.numero_janela,
  j.data_inicio,
  j.data_fim,
  j.data_envio_sugerida,
  j.observacao,
  r.id                       AS remessa_id,
  r.status                   AS remessa_status,
  r.data_programada,
  COALESCE(SUM(CASE WHEN p.status = 'pendente'  THEN 1 ELSE 0 END), 0)::int AS pacientes_pendentes,
  COALESCE(SUM(CASE WHEN p.status = 'enviado'   THEN 1 ELSE 0 END), 0)::int AS pacientes_enviados,
  COALESCE(SUM(CASE WHEN p.status = 'falha'     THEN 1 ELSE 0 END), 0)::int AS pacientes_falhas,
  COALESCE(SUM(CASE WHEN p.status = 'ignorado'  THEN 1 ELSE 0 END), 0)::int AS pacientes_ignorados
FROM public.janelas_atendimento_lembretes j
LEFT JOIN public.lembretes_campanha_remessas r
  ON r.janela_atendimento_id = j.id
LEFT JOIN public.lembretes_campanha_pacientes p
  ON p.remessa_id = r.id
WHERE j.ano_referencia = EXTRACT(YEAR FROM CURRENT_DATE)::int
  AND j.mes_referencia = EXTRACT(MONTH FROM CURRENT_DATE)::int
GROUP BY j.id, r.id
ORDER BY j.numero_janela ASC;

ALTER VIEW public.vw_status_janelas_atual SET (security_invoker = on);
