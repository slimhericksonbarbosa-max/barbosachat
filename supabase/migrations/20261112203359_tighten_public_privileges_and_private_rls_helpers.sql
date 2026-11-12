CREATE SCHEMA IF NOT EXISTS private;

ALTER FUNCTION public.is_conversation_member(uuid) SET SCHEMA private;
ALTER FUNCTION public.handle_new_user() SET SCHEMA private;

REVOKE ALL ON FUNCTION private.is_conversation_member(uuid) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_conversation_member(uuid) TO authenticated;

ALTER FUNCTION public.create_conversation(uuid[], text, boolean) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.create_conversation(uuid[], text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_conversation(uuid[], text, boolean) TO authenticated;

DROP POLICY IF EXISTS "Members can view their conversations" ON public.conversations;
CREATE POLICY "Members can view their conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (private.is_conversation_member(id));

DROP POLICY IF EXISTS "Members can view conversation membership" ON public.conversation_members;
CREATE POLICY "Members can view conversation membership"
  ON public.conversation_members FOR SELECT TO authenticated
  USING (private.is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "Members can read messages" ON public.messages;
CREATE POLICY "Members can read messages"
  ON public.messages FOR SELECT TO authenticated
  USING (private.is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "Members can send as themselves" ON public.messages;
CREATE POLICY "Members can send as themselves"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = (SELECT auth.uid()) AND private.is_conversation_member(conversation_id));

REVOKE ALL ON TABLE public.profiles, public.conversations, public.conversation_members, public.messages FROM anon;
