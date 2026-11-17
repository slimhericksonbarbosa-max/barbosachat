-- Preserve status content independently of the 24-hour status row.
alter table public.status_highlight_items
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists media_path text,
  add column if not exists media_type text,
  add column if not exists caption text not null default '',
  add column if not exists status_created_at timestamptz;

update public.status_highlight_items i
set media_path = s.media_path,
    media_type = s.media_type,
    caption = s.caption,
    status_created_at = s.created_at
from public.status_updates s
where i.status_id = s.id
  and i.media_type is null;

alter table public.status_highlight_items drop constraint if exists status_highlight_items_pkey;
alter table public.status_highlight_items alter column id set not null;
alter table public.status_highlight_items add constraint status_highlight_items_pkey primary key (id);
alter table public.status_highlight_items alter column status_id drop not null;
alter table public.status_highlight_items drop constraint if exists status_highlight_items_status_id_fkey;
alter table public.status_highlight_items
  add constraint status_highlight_items_status_id_fkey
  foreign key (status_id) references public.status_updates(id) on delete set null;
create unique index if not exists status_highlight_items_highlight_status_uidx
  on public.status_highlight_items(highlight_id, status_id) where status_id is not null;

-- Highlights can be shown on authenticated users' profiles; edits remain owner-only.
drop policy if exists "Authenticated users can view status highlights" on public.status_highlights;
create policy "Authenticated users can view status highlights"
  on public.status_highlights for select to authenticated using (true);

drop policy if exists "Authenticated users can view highlight items" on public.status_highlight_items;
create policy "Authenticated users can view highlight items"
  on public.status_highlight_items for select to authenticated using (true);

-- A status file remains readable while it is referenced by a saved highlight.
drop policy if exists "Users can read highlighted status media" on storage.objects;
create policy "Users can read highlighted status media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'status-media'
    and exists (
      select 1
      from public.status_highlight_items i
      join public.status_highlights h on h.id = i.highlight_id
      where i.media_path = storage.objects.name
    )
  );
