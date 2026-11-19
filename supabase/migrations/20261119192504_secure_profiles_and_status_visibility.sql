-- Keep private profile settings readable only by their owner.
-- Public profile discovery is served through a view containing only safe fields.

create or replace function private.can_view_contact(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    (select auth.uid()) is not null
    and (
      target_user_id = (select auth.uid())
      or exists (
        select 1
        from public.conversations c
        where c.is_group = false
          and exists (
            select 1
            from public.conversation_members mine
            where mine.conversation_id = c.id
              and mine.user_id = (select auth.uid())
          )
          and exists (
            select 1
            from public.conversation_members other_member
            where other_member.conversation_id = c.id
              and other_member.user_id = target_user_id
          )
          and (
            select count(*)
            from public.conversation_members cm
            where cm.conversation_id = c.id
          ) = 2
      )
    ),
    false
  );
$function$;

revoke all on function private.can_view_contact(uuid) from public, anon;
grant execute on function private.can_view_contact(uuid) to authenticated;

drop policy if exists "Profiles visible to signed-in users" on public.profiles;
drop policy if exists "Users can read their own private profile settings" on public.profiles;
create policy "Users can read their own private profile settings"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create or replace view public.public_profiles
with (security_invoker = false, security_barrier = true)
as
select id, username, display_name, avatar_url
from public.profiles;

revoke all on table public.public_profiles from public, anon;
grant select on table public.public_profiles to authenticated;

drop policy if exists "Members can view active statuses" on public.status_updates;
drop policy if exists "Owners and direct contacts can view active statuses" on public.status_updates;
create policy "Owners and direct contacts can view active statuses"
  on public.status_updates for select to authenticated
  using (
    expires_at > now()
    and private.can_view_contact(user_id)
  );

drop policy if exists "Users can manage their own status highlights" on public.status_highlights;
drop policy if exists "Authenticated users can view status highlights" on public.status_highlights;
drop policy if exists "Owners and direct contacts can view status highlights" on public.status_highlights;

create policy "Owners and direct contacts can view status highlights"
  on public.status_highlights for select to authenticated
  using (private.can_view_contact(user_id));

create policy "Users can create their own status highlights"
  on public.status_highlights for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own status highlights"
  on public.status_highlights for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own status highlights"
  on public.status_highlights for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can manage items in their own highlights" on public.status_highlight_items;
drop policy if exists "Authenticated users can view highlight items" on public.status_highlight_items;
drop policy if exists "Owners and direct contacts can view highlight items" on public.status_highlight_items;

create policy "Owners and direct contacts can view highlight items"
  on public.status_highlight_items for select to authenticated
  using (
    exists (
      select 1
      from public.status_highlights h
      where h.id = status_highlight_items.highlight_id
        and private.can_view_contact(h.user_id)
    )
  );

create policy "Users can add own statuses to own highlights"
  on public.status_highlight_items for insert to authenticated
  with check (
    status_id is not null
    and exists (
      select 1
      from public.status_highlights h
      where h.id = status_highlight_items.highlight_id
        and h.user_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.status_updates s
      where s.id = status_highlight_items.status_id
        and s.user_id = (select auth.uid())
        and s.media_path is not distinct from status_highlight_items.media_path
        and s.media_type is not distinct from status_highlight_items.media_type
        and s.caption = status_highlight_items.caption
        and s.created_at is not distinct from status_highlight_items.status_created_at
    )
  );

create policy "Users can remove items from own highlights"
  on public.status_highlight_items for delete to authenticated
  using (
    exists (
      select 1
      from public.status_highlights h
      where h.id = status_highlight_items.highlight_id
        and h.user_id = (select auth.uid())
    )
  );
