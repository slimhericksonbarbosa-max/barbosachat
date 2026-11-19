-- Keep privileged conversation operations in the non-exposed private schema.
-- Public RPC entry points remain SECURITY INVOKER wrappers with authenticated-only grants.

alter function public.create_conversation(uuid[], text, boolean) set schema private;
alter function public.respond_to_conversation_invite(uuid, boolean) set schema private;

grant usage on schema private to authenticated;
revoke all on function private.create_conversation(uuid[], text, boolean) from public, anon;
grant execute on function private.create_conversation(uuid[], text, boolean) to authenticated;
revoke all on function private.respond_to_conversation_invite(uuid, boolean) from public, anon;
grant execute on function private.respond_to_conversation_invite(uuid, boolean) to authenticated;

create or replace function public.create_conversation(
  p_member_ids uuid[],
  p_title text default null,
  p_is_group boolean default false
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.create_conversation(p_member_ids, p_title, p_is_group);
$function$;

revoke all on function public.create_conversation(uuid[], text, boolean) from public, anon;
grant execute on function public.create_conversation(uuid[], text, boolean) to authenticated;

create or replace function public.respond_to_conversation_invite(
  p_invite_id uuid,
  p_accept boolean
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.respond_to_conversation_invite(p_invite_id, p_accept);
$function$;

revoke all on function public.respond_to_conversation_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_to_conversation_invite(uuid, boolean) to authenticated;
