INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-media', 'chat-media', false, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = 52428800;

DROP POLICY IF EXISTS "Conversation members can upload chat media" ON storage.objects;
CREATE POLICY "Conversation members can upload chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
  AND private.is_conversation_member(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Conversation members can view chat media" ON storage.objects;
CREATE POLICY "Conversation members can view chat media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media'
  AND private.is_conversation_member(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Owners can delete their chat media" ON storage.objects;
CREATE POLICY "Owners can delete their chat media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
  AND private.is_conversation_member(((storage.foldername(name))[1])::uuid)
);
