drop policy if exists "Conversation participants can view relevant read receipts" on public.message_read_receipts;
create policy "Conversation participants can view relevant read receipts"
on public.message_read_receipts for select to authenticated
using (
  exists (select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.read_receipts_enabled = true)
  and (
    reader_id = (select auth.uid())
    or exists (select 1 from public.messages m
      where m.id = message_id and m.sender_id = (select auth.uid())
        and private.is_conversation_member(m.conversation_id))
  )
);

drop policy if exists "Recipients can record their own message reads" on public.message_read_receipts;
create policy "Recipients can record their own message reads"
on public.message_read_receipts for insert to authenticated
with check (
  reader_id = (select auth.uid())
  and exists (select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.read_receipts_enabled = true)
  and exists (select 1 from public.messages m
    where m.id = message_id and m.sender_id <> (select auth.uid())
      and private.is_conversation_member(m.conversation_id))
);

drop policy if exists "Status owners can see their viewers" on public.status_views;
create policy "Status owners can see their viewers"
on public.status_views for select to authenticated
using (
  exists (select 1 from public.status_updates s
    join public.profiles p on p.id = s.user_id
    where s.id = status_id and s.user_id = (select auth.uid())
      and p.read_receipts_enabled = true)
);

drop policy if exists "Users can record views of others active statuses" on public.status_views;
create policy "Users can record views of others active statuses"
on public.status_views for insert to authenticated
with check (
  viewer_id = (select auth.uid())
  and exists (select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.read_receipts_enabled = true)
  and exists (select 1 from public.status_updates s
    where s.id = status_id and s.user_id <> (select auth.uid()) and s.expires_at > now())
);