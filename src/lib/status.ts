import { supabase } from "./supabase";

export type StatusMediaType = "image" | "video" | "text";

export type StatusUpdate = {
  id: string;
  user_id: string;
  media_path: string | null;
  media_type: StatusMediaType;
  caption: string;
  created_at: string;
  expires_at: string;
};

const MAX_STATUS_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

/** Uploads a private status asset. Database RLS only exposes active status rows. */
export async function publishStatus(input: {
  userId: string;
  fileData: ArrayBuffer | Uint8Array;
  fileName: string;
  contentType: string;
  mediaType: StatusMediaType;
  caption?: string;
}): Promise<StatusUpdate> {
  if (!input.userId) throw new Error("Inicia sessão para publicar um estado.");
  if (!input.fileData.byteLength) throw new Error("O ficheiro está vazio.");
  if (input.fileData.byteLength > MAX_STATUS_BYTES) {
    throw new Error("O ficheiro excede o limite de 50 MB.");
  }
  if (!ALLOWED_TYPES.has(input.contentType)) {
    throw new Error("Formato não suportado para estados.");
  }
  if (input.mediaType === "image" && !input.contentType.startsWith("image/")) {
    throw new Error("Seleciona uma fotografia válida.");
  }
  if (input.mediaType === "video" && !input.contentType.startsWith("video/")) {
    throw new Error("Seleciona um vídeo válido.");
  }

  const safeName = input.fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80) || "estado";
  const path = `${input.userId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("status-media")
    .upload(path, input.fileData, {
      contentType: input.contentType,
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("status_updates")
    .insert({
      user_id: input.userId,
      media_path: path,
      media_type: input.mediaType,
      caption: (input.caption ?? "").trim().slice(0, 700),
    })
    .select("id, user_id, media_path, media_type, caption, created_at, expires_at")
    .single();

  if (error || !data) {
    await supabase.storage.from("status-media").remove([path]).catch(() => undefined);
    throw new Error(error?.message ?? "Não foi possível publicar o estado.");
  }
  return data as StatusUpdate;
}


/** Publishes a text-only status; it expires automatically after 24 hours. */
export async function publishTextStatus(input: {
  userId: string;
  text: string;
}): Promise<StatusUpdate> {
  const caption = input.text.trim();
  if (!input.userId) throw new Error("Inicia sessão para publicar um estado.");
  if (!caption) throw new Error("Escreve o texto do teu estado.");
  if (caption.length > 700) throw new Error("O estado pode ter no máximo 700 caracteres.");
  const { data, error } = await supabase
    .from("status_updates")
    .insert({
      user_id: input.userId,
      media_path: null,
      media_type: "text",
      caption,
    })
    .select("id, user_id, media_path, media_type, caption, created_at, expires_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Não foi possível publicar o estado.");
  return data as StatusUpdate;
}

/** Lists only statuses that are still active; RLS independently enforces this. */
export async function listActiveStatuses(): Promise<StatusUpdate[]> {
  const { data, error } = await supabase
    .from("status_updates")
    .select("id, user_id, media_path, media_type, caption, created_at, expires_at")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as StatusUpdate[];
}

export type StatusViewer = {
  viewer_id: string;
  viewed_at: string;
  display_name: string;
  username: string | null;
};

/** Records a single view per user and status. RLS verifies viewer identity. */
export async function recordStatusView(statusId: string, viewerId: string): Promise<void> {
  const { error } = await supabase
    .from("status_views")
    .upsert({ status_id: statusId, viewer_id: viewerId }, {
      onConflict: "status_id,viewer_id",
      ignoreDuplicates: true,
    });
  if (error) throw new Error(error.message);
}

/** Only the owner of the status can retrieve its viewer list (enforced by RLS). */
export async function listStatusViewers(statusId: string): Promise<StatusViewer[]> {
  const { data: views, error } = await supabase
    .from("status_views")
    .select("viewer_id, viewed_at")
    .eq("status_id", statusId)
    .order("viewed_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = views ?? [];
  if (!rows.length) return [];
  const viewerIds = [...new Set(rows.map((row) => row.viewer_id))];
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", viewerIds);
  if (profileError) throw new Error(profileError.message);
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return rows.map((row) => ({
    viewer_id: row.viewer_id,
    viewed_at: row.viewed_at,
    display_name: profileById.get(row.viewer_id)?.display_name || profileById.get(row.viewer_id)?.username || "Utilizador",
    username: profileById.get(row.viewer_id)?.username ?? null,
  }));
}

/** Returns a short-lived URL for an active status in the private bucket. */
export async function createStatusMediaUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("status-media")
    .createSignedUrl(path, 60 * 10);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Deletes the caller's status row and its private media object. */
export async function deleteStatus(statusId: string, mediaPath: string): Promise<void> {
  const { error } = await supabase
    .from("status_updates")
    .delete()
    .eq("id", statusId);
  if (error) throw new Error(error.message);
  const { error: storageError } = await supabase.storage
    .from("status-media")
    .remove([mediaPath]);
  if (storageError) throw new Error(storageError.message);
}
