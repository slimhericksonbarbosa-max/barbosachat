-- Add covering indexes for foreign keys identified by the Supabase Performance Advisor.
create index if not exists conversation_invites_inviter_id_idx
  on public.conversation_invites (inviter_id);

create index if not exists message_favorites_message_id_idx
  on public.message_favorites (message_id);

create index if not exists message_pins_message_id_idx
  on public.message_pins (message_id);

create index if not exists message_pins_pinned_by_idx
  on public.message_pins (pinned_by);

create index if not exists status_highlights_cover_item_id_idx
  on public.status_highlights (cover_item_id);

create index if not exists status_highlights_cover_status_id_idx
  on public.status_highlights (cover_status_id);
