import { supabase } from "./supabase";
import type { StatusUpdate } from "./status";

export type MessagePin = {
  id: string; conversation_id: string; message_id: string; pinned_by: string; created_at: string;
};
export type StatusHighlightItem = {
  id: string; status_id: string | null; added_at: string;
  media_path: string | null; media_type: "image" | "video" | "text";
  caption: string; status_created_at: string | null;
};
export type StatusHighlight = {
  id: string; user_id: string; title: string; cover_status_id: string | null; cover_item_id?: string | null;
  created_at: string; items: StatusHighlightItem[];
};

function fail(error: { message: string } | null): void { if (error) throw new Error(error.message); }

export async function listConversationPins(conversationId: string): Promise<MessagePin[]> {
  const { data, error } = await supabase.from("message_pins")
    .select("id, conversation_id, message_id, pinned_by, created_at")
    .eq("conversation_id", conversationId).order("created_at", { ascending: false });
  fail(error); return (data ?? []) as MessagePin[];
}
export async function pinMessage(conversationId: string, messageId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("message_pins").insert({ conversation_id: conversationId, message_id: messageId, pinned_by: userId });
  fail(error);
}
export async function unpinMessage(pinId: string): Promise<void> {
  const { error } = await supabase.from("message_pins").delete().eq("id", pinId); fail(error);
}
export async function listFavoriteMessageIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("message_favorites").select("message_id")
    .eq("user_id", userId).order("created_at", { ascending: false });
  fail(error); return (data ?? []).map((row) => row.message_id);
}
export async function setMessageFavorite(messageId: string, userId: string, favorite: boolean): Promise<void> {
  if (favorite) {
    const { error } = await supabase.from("message_favorites")
      .upsert({ message_id: messageId, user_id: userId }, { onConflict: "user_id,message_id", ignoreDuplicates: true });
    fail(error);
  } else {
    const { error } = await supabase.from("message_favorites").delete().eq("message_id", messageId).eq("user_id", userId);
    fail(error);
  }
}
function mapHighlights(rows: any[]): StatusHighlight[] {
  return (rows ?? []).map((row) => ({ ...row, items: row.status_highlight_items ?? [] })) as StatusHighlight[];
}
export async function listMyStatusHighlights(userId: string): Promise<StatusHighlight[]> {
  const { data, error } = await supabase.from("status_highlights")
    .select("id,user_id,title,cover_status_id,cover_item_id,created_at,status_highlight_items!status_highlight_items_highlight_id_fkey(id,status_id,added_at,media_path,media_type,caption,status_created_at)")
    .eq("user_id", userId).order("created_at", { ascending: true });
  fail(error); return mapHighlights(data ?? []);
}
export async function listProfileStatusHighlights(userId: string): Promise<StatusHighlight[]> {
  const { data, error } = await supabase.from("status_highlights")
    .select("id,user_id,title,cover_status_id,created_at,status_highlight_items(id,status_id,added_at,media_path,media_type,caption,status_created_at)")
    .eq("user_id", userId).order("created_at", { ascending: true });
  fail(error); return mapHighlights(data ?? []);
}
export async function createStatusHighlight(userId: string, title: string, statuses: StatusUpdate[]): Promise<string> {
  const cleanTitle = title.trim();
  const unique = [...new Map(statuses.map((status) => [status.id, status])).values()];
  if (!cleanTitle || cleanTitle.length > 40) throw new Error("O nome do destaque deve ter entre 1 e 40 caracteres.");
  if (!unique.length) throw new Error("Seleciona pelo menos um estado para guardar.");
  const { data, error } = await supabase.from("status_highlights")
    .insert({ user_id: userId, title: cleanTitle, cover_status_id: unique[0].id }).select("id").single();
  fail(error); if (!data?.id) throw new Error("Não foi possível criar o destaque.");
  const { error: itemsError } = await supabase.from("status_highlight_items").insert(unique.map((status) => ({
    highlight_id: data.id, status_id: status.id, media_path: status.media_path,
    media_type: status.media_type, caption: status.caption, status_created_at: status.created_at,
  })));
  if (itemsError) { await supabase.from("status_highlights").delete().eq("id", data.id); throw new Error(itemsError.message); }
  return data.id;
}
export async function addStatusToHighlight(highlightId: string, status: StatusUpdate): Promise<void> {
  const { error } = await supabase.from("status_highlight_items").insert({
    highlight_id: highlightId, status_id: status.id, media_path: status.media_path,
    media_type: status.media_type, caption: status.caption, status_created_at: status.created_at,
  });
  fail(error);
}
export async function removeStatusFromHighlight(itemId: string): Promise<void> {
  const { error } = await supabase.from("status_highlight_items").delete().eq("id", itemId); fail(error);
}
export async function renameStatusHighlight(highlightId: string, title: string): Promise<void> {
  const clean = title.trim(); if (!clean || clean.length > 40) throw new Error("O nome deve ter entre 1 e 40 caracteres.");
  const { error } = await supabase.from("status_highlights").update({ title: clean, updated_at: new Date().toISOString() }).eq("id", highlightId);
  fail(error);
}
export async function setStatusHighlightCover(highlightId: string, itemId: string | null): Promise<void> {
  const { error } = await supabase.from("status_highlights").update({ cover_item_id: itemId, updated_at: new Date().toISOString() }).eq("id", highlightId);
  fail(error);
}
export async function deleteStatusHighlight(highlightId: string): Promise<void> {
  const { error } = await supabase.from("status_highlights").delete().eq("id", highlightId); fail(error);
}


export type FavoriteMessageRecord = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  message_type: "text" | "image" | "video" | "audio" | "file";
  created_at: string;
  media_path: string | null;
  media_name: string | null;
  media_content_type: string | null;
  favorited_at: string;
};

export async function listFavoriteMessages(userId: string): Promise<FavoriteMessageRecord[]> {
  const { data, error } = await supabase.from("message_favorites")
    .select("created_at,messages!inner(id,conversation_id,sender_id,body,message_type,created_at,media_path,media_name,media_content_type,deleted_at)")
    .eq("user_id", userId)
    .is("messages.deleted_at", null)
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []).flatMap((row: any) => {
    const message = Array.isArray(row.messages) ? row.messages[0] : row.messages;
    if (!message) return [];
    return [{ ...message, favorited_at: row.created_at }] as FavoriteMessageRecord[];
  });
}
