alter table public.status_updates
  alter column media_path drop not null,
  drop constraint if exists status_updates_media_type_check,
  add constraint status_updates_media_type_check
    check (media_type in ('image', 'video', 'text'));

drop policy if exists "Users can publish their own statuses" on public.status_updates;
create policy "Users can publish their own statuses"
  on public.status_updates for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and expires_at > now()
    and (
      (media_type = 'text' and media_path is null
        and char_length(btrim(caption)) between 1 and 700)
      or
      (media_type in ('image', 'video') and media_path is not null
        and split_part(media_path, '/', 1) = (select auth.uid())::text)
    )
  );
