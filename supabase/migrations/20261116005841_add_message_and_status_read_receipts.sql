alter table public.profiles
  add column if not exists read_receipts_enabled boolean not null default true;

create table if not exists public.message_read_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  reader_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, reader_id)
);
alter table public.message_read_receipts enable row level security;
grant select, insert on public.message_read_receipts to authenticated;

create policy "Conversation participants can view relevant read receipts"
on public.message_read_receipts for select to authenticated
using (
  reader_id = (select auth.uid())
  or exists (
    select 1 from public.messages m
    where m.id = message_id and m.sender_id = (select auth.uid())
      and private.is_conversation_member(m.conversation_id)
  )
);
create policy "Recipients can record their own message reads"
on public.message_read_receipts for insert to authenticated
with check (
  reader_id = (select auth.uid())
  and exists (
    select 1 from public.messages m
    where m.id = message_id and m.sender_id <> (select auth.uid())
      and private.is_conversation_member(m.conversation_id)
  )
);

create table if not exists public.status_views (
  status_id uuid not null references public.status_updates(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (status_id, viewer_id)
);
create index if not exists status_views_viewer_id_idx on public.status_views(viewer_id);
alter table public.status_views enable row level security;
grant select, insert on public.status_views to authenticated;

create policy "Status owners can see their viewers"
on public.status_views for select to authenticated
using (
  exists (select 1 from public.status_updates s
    where s.id = status_id and s.user_id = (select auth.uid()))
);
create policy "Users can record views of others active statuses"
on public.status_views for insert to authenticated
with check (
  viewer_id = (select auth.uid())
  and exists (select 1 from public.status_updates s
    where s.id = status_id and s.user_id <> (select auth.uid()) and s.expires_at > now())
);