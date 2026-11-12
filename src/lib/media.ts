import { supabase } from "./supabase";

export type ChatMediaKind = "image" | "video" | "audio" | "file";

export type UploadedChatMedia = {
  path: string;
  kind: ChatMediaKind;
  contentType: string;
  originalName: string;
};

/**
 * Uploads media to a private conversation-scoped bucket.
 * The Storage RLS policies enforce that the signed-in user is a member
 * of the conversation and that the object is stored in their own folder.
 */
export async function uploadChatMedia(input: {
  conversationId: string;
  userId: string;
  fileData: ArrayBuffer | Uint8Array;
  fileName: string;
  contentType: string;
  kind: ChatMediaKind;
}): Promise<UploadedChatMedia> {
  if (!input.fileData.byteLength) {
    throw new Error("O ficheiro está vazio.");
  }
  if (input.fileData.byteLength > 50 * 1024 * 1024) {
    throw new Error("O ficheiro excede o limite de 50 MB.");
  }

  const safeName = input.fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-100) || "ficheiro";
  const suffix = Math.random().toString(36).slice(2, 10);
  const path = `${input.conversationId}/${input.userId}/${Date.now()}-${suffix}-${safeName}`;

  const { error } = await supabase.storage
    .from("chat-media")
    .upload(path, input.fileData, {
      contentType: input.contentType || "application/octet-stream",
      upsert: false,
    });

  if (error) throw new Error(error.message);

  return {
    path,
    kind: input.kind,
    contentType: input.contentType || "application/octet-stream",
    originalName: input.fileName,
  };
}

/** Creates a short-lived private URL after Storage has checked membership. */
export async function createChatMediaUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("chat-media")
    .createSignedUrl(path, 60 * 60);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Deletes an uploaded object; Storage RLS only permits its owner to delete it. */
export async function deleteChatMedia(path: string): Promise<void> {
  const { error } = await supabase.storage.from("chat-media").remove([path]);
  if (error) throw new Error(error.message);
}
