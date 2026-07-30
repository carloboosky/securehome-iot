ALTER TABLE public.service_messages
  ALTER COLUMN message DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

ALTER TABLE public.service_messages
  DROP CONSTRAINT IF EXISTS service_messages_message_check;

ALTER TABLE public.service_messages
  ADD CONSTRAINT service_messages_content_check
  CHECK (
    (message IS NOT NULL AND char_length(message) BETWEEN 1 AND 1000)
    OR image_path IS NOT NULL
  );

GRANT SELECT, INSERT ON public.service_messages TO authenticated;
REVOKE UPDATE ON public.service_messages FROM authenticated;
GRANT UPDATE (read_at) ON public.service_messages TO authenticated;

DROP POLICY IF EXISTS "Destinatarios marcan mensajes leídos" ON public.service_messages;
CREATE POLICY "Destinatarios marcan mensajes leídos"
ON public.service_messages FOR UPDATE TO authenticated
USING (
  (sender_role = 'admin' AND public.owns_service_request(request_id))
  OR (sender_role = 'client' AND public.is_admin())
)
WITH CHECK (
  (sender_role = 'admin' AND public.owns_service_request(request_id))
  OR (sender_role = 'client' AND public.is_admin())
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-images',
  'chat-images',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "Participantes suben fotos del chat" ON storage.objects;
CREATE POLICY "Participantes suben fotos del chat"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND (
    public.is_admin()
    OR public.owns_service_request(((storage.foldername(name))[1])::uuid)
  )
);

DROP POLICY IF EXISTS "Participantes ven fotos del chat" ON storage.objects;
CREATE POLICY "Participantes ven fotos del chat"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (
    public.is_admin()
    OR public.owns_service_request(((storage.foldername(name))[1])::uuid)
  )
);
