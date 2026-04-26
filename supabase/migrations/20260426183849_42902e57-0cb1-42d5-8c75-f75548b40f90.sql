
ALTER TABLE public.google_calendar_tokens
  ADD COLUMN IF NOT EXISTS google_email TEXT,
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

CREATE TABLE IF NOT EXISTS public.google_calendar_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  default_duration_min INTEGER NOT NULL DEFAULT 30,
  reminder_popup_min INTEGER[] NOT NULL DEFAULT ARRAY[60, 1440],
  event_color_id TEXT,
  include_patient_phone BOOLEAN NOT NULL DEFAULT true,
  include_convenio BOOLEAN NOT NULL DEFAULT true,
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.google_calendar_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage own gcal settings" ON public.google_calendar_settings;
CREATE POLICY "Admins manage own gcal settings"
  ON public.google_calendar_settings
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_google_calendar_settings_updated_at ON public.google_calendar_settings;
CREATE TRIGGER update_google_calendar_settings_updated_at
  BEFORE UPDATE ON public.google_calendar_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
