-- Replace the SECURITY DEFINER view with a dedicated public-profile projection table.
-- This prevents the Data API from exposing private profile settings.

drop view if exists public.public_profiles;

create table public.public_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  username text,
  display_name text not null default '',
  avatar_url text
);

alter table public.public_profiles enable row level security;
revoke all on table public.public_profiles from public, anon, authenticated;
grant select on table public.public_profiles to authenticated;

drop policy if exists "Authenticated users can view public profile fields" on public.public_profiles;
create policy "Authenticated users can view public profile fields"
  on public.public_profiles for select to authenticated
  using (true);

create or replace function private.sync_public_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    delete from public.public_profiles where id = old.id;
    return old;
  end if;

  insert into public.public_profiles (id, username, display_name, avatar_url)
  values (new.id, new.username, new.display_name, new.avatar_url)
  on conflict (id) do update
    set username = excluded.username,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url;

  return new;
end;
$function$;

revoke all on function private.sync_public_profile() from public, anon, authenticated;

drop trigger if exists sync_public_profile on public.profiles;
create trigger sync_public_profile
  after insert or update or delete on public.profiles
  for each row execute function private.sync_public_profile();

insert into public.public_profiles (id, username, display_name, avatar_url)
select id, username, display_name, avatar_url
from public.profiles
on conflict (id) do update
  set username = excluded.username,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url;
