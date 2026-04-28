ALTER TABLE public.hermes_conversation_state
  ADD COLUMN IF NOT EXISTS paused_question_state jsonb;