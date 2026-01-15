-- Restrict WhatsApp images bucket upload to admins only
DROP POLICY IF EXISTS "Authenticated users can upload whatsapp images" ON storage.objects;
CREATE POLICY "Admins can upload whatsapp images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'whatsapp-images' 
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Restrict WhatsApp images bucket delete to admins only
DROP POLICY IF EXISTS "Authenticated users can delete whatsapp images" ON storage.objects;
CREATE POLICY "Admins can delete whatsapp images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'whatsapp-images' 
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);