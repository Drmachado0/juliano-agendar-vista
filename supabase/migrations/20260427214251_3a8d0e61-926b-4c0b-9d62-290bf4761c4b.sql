CREATE TABLE IF NOT EXISTS public.hermes_conversation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  lead_id uuid,
  last_intent text,
  awaiting text,
  last_options jsonb,
  selected_data date,
  selected_periodo text,
  selected_local text,
  available_slots jsonb,
  ambiguous_count integer NOT NULL DEFAULT 0,
  sandbox boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS hermes_conversation_state_phone_uniq
  ON public.hermes_conversation_state (phone);

CREATE INDEX IF NOT EXISTS hermes_conversation_state_updated_at_idx
  ON public.hermes_conversation_state (updated_at DESC);

ALTER TABLE public.hermes_conversation_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage hermes conversation state"
  ON public.hermes_conversation_state
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));