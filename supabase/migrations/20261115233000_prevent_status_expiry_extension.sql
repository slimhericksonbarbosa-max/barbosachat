drop policy if exists "Users can update their own statuses" on public.status_updates;
revoke update on public.status_updates from authenticated;
grant select, insert, delete on public.status_updates to authenticated;
