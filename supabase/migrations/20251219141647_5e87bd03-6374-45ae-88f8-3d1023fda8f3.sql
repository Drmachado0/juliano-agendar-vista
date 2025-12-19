-- Create public bucket for WhatsApp images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-images',
  'whatsapp-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read from this bucket (public images for WhatsApp)
CREATE POLICY "Public read access for whatsapp images"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-images');

-- Only authenticated users can upload
CREATE POLICY "Authenticated users can upload whatsapp images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-images' AND auth.role() = 'authenticated');

-- Authenticated users can delete their uploads
CREATE POLICY "Authenticated users can delete whatsapp images"
ON storage.objects FOR DELETE
USING (bucket_id = 'whatsapp-images' AND auth.role() = 'authenticated');