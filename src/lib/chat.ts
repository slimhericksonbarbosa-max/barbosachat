import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type StoredMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  message_type: "text" | "image" | "video" | "audio" | "file";
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  media_path: string | null;
  media_name: string | null;
  media_content_type: string | null;
};

export type ConversationSummary = {
  id: string;
  title: string | null;
  is_group: boolean;
  created_at: string;
  last_message: StoredMessage | null;
  other_member: { display_name: string; username: string | null } | null;
};

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** Loads only conversations in which the signed-in user is a member. */
export async function listMyConversations(userId: string): Promise<ConversationSummary[]> {
  const memberships = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);
  throwIfError(memberships.error);

  const ids = (memberships.data ?? []).map((row) => row.conversation_id);
  if (ids.length === 0) return [];

  const conversations = await supabase
    .from("conversations")
    .select("id, title, is_group, created_at")
    .in("id", ids)
    .order("created_at", { ascending: false });
  throwIfError(conversations.error);

  const latestMessages = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, message_type, media_path, media_name, media_content_type, created_at, edited_at, deleted_at")
    .in("conversation_id", ids)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  throwIfError(latestMessages.error);

  const latestByConversation = new Map<string, StoredMessage>();
  for (const message of latestMessages.data ?? []) {
    if (!latestByConversation.has(message.conversation_id)) {
      latestByConversation.set(message.conversation_id, message as StoredMessage);
    }
  }

  const otherMembers = await supabase
    .from("conversation_members")
    .select("conversation_id, profiles(display_name, username)")
    .in("conversation_id", ids)
    .neq("user_id", userId);
  throwIfError(otherMembers.error);

  const otherMemberByConversation = new Map<string, { display_name: string; username: string | null }>();
  for (const row of otherMembers.data ?? []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (profile && !otherMemberByConversation.has(row.conversation_id)) {
      otherMemberByConversation.set(row.conversation_id, {
        display_name: profile.display_name || "",
        username: profile.username,
      });
    }
  }

  return (conversations.data ?? []).map((conversation) => ({
    ...conversation,
    last_message: latestByConversation.get(conversation.id) ?? null,
    other_member: otherMemberByConversation.get(conversation.id) ?? null,
  }));
}

/** Loads the message history in chronological order. */
export async function listMessages(conversationId: string): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, message_type, media_path, media_name, media_content_type, created_at, edited_at, deleted_at")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  throwIfError(error);
  return (data ?? []) as StoredMessage[];
}

/** Persists a text message. RLS verifies membership and sender identity. */
export async function sendTextMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<StoredMessage> {
  const cleanBody = body.trim();
  if (!cleanBody) throw new Error("A mensagem não pode estar vazia.");
  if (cleanBody.length > 10000) throw new Error("A mensagem excede o limite de 10 000 caracteres.");

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: cleanBody,
      message_type: "text",
    })
    .select("id, conversation_id, sender_id, body, message_type, media_path, media_name, media_content_type, created_at, edited_at, deleted_at")
    .single();
  throwIfError(error);
  return data as StoredMessage;
}

/** Persists a message that points to an object in the private chat-media bucket. */
export async function sendMediaMessage(
  conversationId: string,
  senderId: string,
  media: { path: string; name: string; contentType: string; kind: "image" | "video" | "audio" | "file" },
): Promise<StoredMessage> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: media.name,
      message_type: media.kind,
      media_path: media.path,
      media_name: media.name,
      media_content_type: media.contentType,
    })
    .select("id, conversation_id, sender_id, body, message_type, media_path, media_name, media_content_type, created_at, edited_at, deleted_at")
    .single();
  throwIfError(error);
  return data as StoredMessage;
}

/** Creates a conversation and all memberships atomically through a database function. */
export async function createConversation(
  creatorId: string,
  memberIds: string[],
  options: { title?: string; isGroup?: boolean } = {},
): Promise<string> {
  const uniqueMemberIds = [...new Set([creatorId, ...memberIds])];
  const isGroup = options.isGroup ?? uniqueMemberIds.length > 2;

  const { data, error } = await supabase.rpc("create_conversation", {
    p_member_ids: uniqueMemberIds,
    p_title: options.title?.trim() || null,
    p_is_group: isGroup,
  });
  throwIfError(error);
  if (typeof data !== "string") throw new Error("O servidor não devolveu o identificador da conversa.");
  return data;
}

/** Subscribes to newly inserted messages for one conversation. */
export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: StoredMessage) => void,
): RealtimeChannel {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onMessage(payload.new as StoredMessage),
    )
    .subscribe();
}

export type ContactProfile = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
};

/** Lists public profile fields, excluding the current user. */
export async function listContacts(currentUserId: string): Promise<ContactProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .neq("id", currentUserId)
    .order("display_name", { ascending: true });
  throwIfError(error);
  return (data ?? []) as ContactProfile[];
}
