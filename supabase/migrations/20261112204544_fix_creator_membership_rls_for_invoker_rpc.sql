CREATE OR REPLACE FUNCTION private.is_conversation_creator(target_conversation uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = target_conversation
      AND c.created_by = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION private.is_conversation_creator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_conversation_creator(uuid) TO authenticated;

DROP POLICY IF EXISTS "Conversation creator can add members" ON public.conversation_members;
CREATE POLICY "Conversation creator can add members"
  ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (private.is_conversation_creator(conversation_id));
