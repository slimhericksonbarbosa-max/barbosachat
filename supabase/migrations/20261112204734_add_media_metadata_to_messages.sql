ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_path text,
  ADD COLUMN IF NOT EXISTS media_name text,
  ADD COLUMN IF NOT EXISTS media_content_type text;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_media_metadata_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_media_metadata_check
  CHECK (
    (message_type = 'text' AND media_path IS NULL)
    OR
    (message_type <> 'text' AND media_path IS NOT NULL)
  );
