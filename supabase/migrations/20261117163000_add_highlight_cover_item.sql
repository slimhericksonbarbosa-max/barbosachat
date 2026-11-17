alter table public.status_highlights
  add column if not exists cover_item_id uuid references public.status_highlight_items(id) on delete set null;
