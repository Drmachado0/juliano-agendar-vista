
-- 1. Fix google_calendar_settings policy (simplify redundant admin check)
DROP POLICY IF EXISTS "Admins manage own gcal settings" ON public.google_calendar_settings;
CREATE POLICY "Admins manage own gcal settings"
  ON public.google_calendar_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid());

-- 2. Restrict whatsapp-images bucket SELECT to admins only (bucket remains
-- public for direct-URL delivery to Evolution API; RLS SELECT is admin-only).
DROP POLICY IF EXISTS "Public read access for whatsapp images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read access for whatsapp images" ON storage.objects;
CREATE POLICY "Admins read whatsapp images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'whatsapp-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 3. Add channel-level authorization on realtime.messages restricting subscriptions
-- to authenticated admins (matches current app model where only admins are auth users).
DROP POLICY IF EXISTS "Admins subscribe to realtime channels" ON realtime.messages;
CREATE POLICY "Admins subscribe to realtime channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
