
CREATE TABLE IF NOT EXISTS public.site_config (
  id boolean NOT NULL PRIMARY KEY DEFAULT true,
  whatsapp_number text NOT NULL DEFAULT '5591980690617',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT site_config_singleton CHECK (id = true)
);

INSERT INTO public.site_config (id, whatsapp_number)
VALUES (true, '5591980690617')
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.site_config TO anon;
GRANT SELECT, UPDATE ON public.site_config TO authenticated;
GRANT ALL ON public.site_config TO service_role;

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read site_config"
  ON public.site_config FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can update site_config"
  ON public.site_config FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
