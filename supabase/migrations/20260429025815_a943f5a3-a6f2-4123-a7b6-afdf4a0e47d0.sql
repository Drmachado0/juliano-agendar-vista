ALTER TABLE public.bot_config
  ADD COLUMN IF NOT EXISTS bot_global_ativo boolean NOT NULL DEFAULT true;

-- Garante que a linha singleton existe
INSERT INTO public.bot_config (id, pausa_automatica_ativa, pausa_automatica_minutos, bot_global_ativo)
VALUES (true, true, 30, true)
ON CONFLICT (id) DO NOTHING;