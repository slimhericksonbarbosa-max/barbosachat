REVOKE EXECUTE ON FUNCTION public.create_conversation(uuid[], text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_conversation(uuid[], text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS conversations_created_by_idx ON public.conversations(created_by);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON public.messages(sender_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
