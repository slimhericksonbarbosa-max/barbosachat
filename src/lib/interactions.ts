import { supabase } from "./supabase";

export type MessagePin = {
  id: string;
  conversation_id: string;
  message_id: string;
  pinned_by: string;
  created_at: string;
};

export type StatusHighlight = {
  id: string;
  user_id: string;
  title: string;
  cover_status_id: string | null;
  created_at: string;
  items?: { status_id: string; added_at: string }[];
};

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function listConversationPins(conversationId: string): Promise<MessagePin[]> {
  const { data, error } = await supabase.from("message_pins")
    .select("id, conversation_id, message_id, pinned_by, created_at")
    .eq("conversation_id", conversationId).order("created_at", { ascending: false });
  fail(error);
  return (data ?? []) as MessagePin[];
}

export async function pinMessage(conversationId: string, messageId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("message_pins")
    .insert({ conversation_id: conversationId, message_id: messageId, pinned_by: userId });
  fail(error);
}

export async function unpinMessage(pinId: string): Promise<void> {
  const { error } = await supabase.from("message_pins").delete().eq("id", pinId);
  fail(error);
}

export async function listFavoriteMessageIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("message_favorites")
    .select("message_id").eq("user_id", userId).order("created_at", { ascending: false });
  fail(error);
  return (data ?? []).map((row) => row.message_id);
}

export async function setMessageFavorite(messageId: string, userId: string, favorite: boolean): Promise<void> {
  if (favorite) {
    const { error } = await supabase.from("message_favorites")
      .upsert({ message_id: messageId, user_id: userId }, { onConflict: "user_id,message_id", ignoreDuplicates: true });
    fail(error);
  } else {
    const { error } = await supabase.from("message_favorites")
      .delete().eq("message_id", messageId).eq("user_id", userId);
    fail(error);
  }
}

export async function listMyStatusHighlights(userId: string): Promise<StatusHighlight[]> {
  const { data, error } = await supabase.from("status_highlights")
    .select("id, user_id, title, cover_status_id, created_at, status_highlight_items(status_id, added_at)")
    .eq("user_id", userId).order("created_at", { ascending: true });
  fail(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    cover_status_id: row.cover_status_id,
    created_at: row.created_at,
    items: row.status_highlight_items ?? [],
  })) as StatusHighlight[];
}

export async function createStatusHighlight(userId: string, title: string, statusIds: string[]): Promise<string> {
  const cleanTitle = title.trim();
  const uniqueIds = [...new Set(statusIds)].filter(Boolean);
  if (!cleanTitle || cleanTitle.length > 40) throw new Error("O nome do destaque deve ter entre 1 e 40 caracteres.");
  if (!uniqueIds.length) throw new Error("Seleciona pelo menos um estado para guardar.");
  const { data, error } = await supabase.from("status_highlights")
    .insert({ user_id: userId, title: cleanTitle, cover_status_id: uniqueIds[0] })
    .select("id").single();
  fail(error);
  if (!data?.id) throw new Error("Não foi possível criar o destaque.");
  const { error: itemsError } = await supabase.from("status_highlight_items")
    .insert(uniqueIds.map((status_id) => ({ highlight_id: data.id, status_id })));
  if (itemsError) {
    await supabase.from("status_highlights").delete().eq("id", data.id);
    throw new Error(itemsError.message);
  }
  return data.id;
}

export async function addStatusToHighlight(highlightId: string, statusId: string): Promise<void> {
  const { error } = await supabase.from("status_highlight_items")
    .upsert({ highlight_id: highlightId, status_id: statusId }, { onConflict: "highlight_id,status_id", ignoreDuplicates: true });
  fail(error);
}

export async function deleteStatusHighlight(highlightId: string): Promise<void> {
  const { error } = await supabase.from("status_highlights").delete().eq("id", highlightId);
  fail(error);
}
