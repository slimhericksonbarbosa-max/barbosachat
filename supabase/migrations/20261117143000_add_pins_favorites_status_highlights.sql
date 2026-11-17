-- Barbosachat: pinned messages, personal favorites, and permanent status highlights.
create table if not exists public.message_pins (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (conversation_id, message_id)
);
create index if not exists message_pins_conversation_created_idx on public.message_pins(conversation_id, created_at desc);
alter table public.message_pins enable row level security;
grant select, insert, delete on public.message_pins to authenticated;
create policy "Members can view pins in their conversations" on public.message_pins for select to authenticated using (private.is_conversation_member(conversation_id));
create policy "Members can pin messages in their conversations" on public.message_pins for insert to authenticated with check (
  pinned_by = (select auth.uid()) and private.is_conversation_member(conversation_id)
  and exists (select 1 from public.messages m where m.id = message_id and m.conversation_id = message_pins.conversation_id)
);
create policy "Members can unpin messages in their conversations" on public.message_pins for delete to authenticated using (private.is_conversation_member(conversation_id));

create table if not exists public.message_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);
create index if not exists message_favorites_user_created_idx on public.message_favorites(user_id, created_at desc);
alter table public.message_favorites enable row level security;
grant select, insert, delete on public.message_favorites to authenticated;
create policy "Users can view their own message favorites" on public.message_favorites for select to authenticated using (user_id = (select auth.uid()));
create policy "Users can favorite messages in their conversations" on public.message_favorites for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.messages m where m.id = message_id and private.is_conversation_member(m.conversation_id)
  )
);
create policy "Users can remove their own message favorites" on public.message_favorites for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.status_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 40),
  cover_status_id uuid references public.status_updates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists status_highlights_user_created_idx on public.status_highlights(user_id, created_at);
alter table public.status_highlights enable row level security;
grant select, insert, update, delete on public.status_highlights to authenticated;

create table if not exists public.status_highlight_items (
  highlight_id uuid not null references public.status_highlights(id) on delete cascade,
  status_id uuid not null references public.status_updates(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (highlight_id, status_id)
);
create index if not exists status_highlight_items_status_idx on public.status_highlight_items(status_id);
alter table public.status_highlight_items enable row level security;
grant select, insert, delete on public.status_highlight_items to authenticated;
create policy "Users can manage their own status highlights" on public.status_highlights for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users can manage items in their own highlights" on public.status_highlight_items for all to authenticated
using (exists (select 1 from public.status_highlights h where h.id = highlight_id and h.user_id = (select auth.uid())))
with check (
  exists (select 1 from public.status_highlights h where h.id = highlight_id and h.user_id = (select auth.uid()))
  and exists (select 1 from public.status_updates s where s.id = status_id and s.user_id = (select auth.uid()))
);
