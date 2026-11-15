create table if not exists public.status_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_path text not null unique,
  media_type text not null check (media_type in ('image','video')),
  caption text not null default '' check (char_length(caption) <= 700),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint status_expiry_after_creation check (expires_at > created_at)
);

create index if not exists status_updates_active_created_idx
  on public.status_updates (expires_at desc, created_at desc);
create index if not exists status_updates_user_active_idx
  on public.status_updates (user_id, expires_at desc);

alter table public.status_updates enable row level security;
grant select, insert, update, delete on public.status_updates to authenticated;

create policy "Members can view active statuses"
  on public.status_updates for select to authenticated
  using (expires_at > now());
create policy "Users can publish their own statuses"
  on public.status_updates for insert to authenticated
  with check (user_id = (select auth.uid())
    and split_part(media_path, '/', 1) = (select auth.uid())::text
    and expires_at > now());
create policy "Users can update their own statuses"
  on public.status_updates for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and split_part(media_path, '/', 1) = (select auth.uid())::text);
create policy "Users can delete their own statuses"
  on public.status_updates for delete to authenticated
  using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('status-media', 'status-media', false, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = false, file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload own status media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'status-media'
    and split_part(name, '/', 1) = (select auth.uid())::text);
create policy "Users can read active status media"
  on storage.objects for select to authenticated
  using (bucket_id = 'status-media' and exists (
    select 1 from public.status_updates s
    where s.media_path = storage.objects.name and s.expires_at > now()
  ));
create policy "Users can delete own status media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'status-media'
    and split_part(name, '/', 1) = (select auth.uid())::text);
