ALTER TABLE public.google_calendar_tokens
ADD COLUMN IF NOT EXISTS time_zone TEXT;