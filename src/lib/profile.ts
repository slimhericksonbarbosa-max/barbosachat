import { supabase } from "./supabase";

const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024;

/** Uploads a profile image to the public profile-photo bucket and saves its URL. */
export async function uploadProfilePhoto(input: {
  userId: string;
  fileData: ArrayBuffer | Uint8Array;
  contentType: string;
  fileName: string;
}): Promise<string> {
  if (!input.contentType.startsWith("image/")) {
    throw new Error("Escolhe uma fotografia válida.");
  }
  if (!input.fileData.byteLength || input.fileData.byteLength > MAX_PROFILE_PHOTO_SIZE) {
    throw new Error("A fotografia deve ter até 5 MB.");
  }

  const extensionFromType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  const extension = extensionFromType[input.contentType] || input.fileName.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${input.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("profile-photos")
    .upload(path, input.fileData, {
      contentType: input.contentType,
      upsert: false,
      cacheControl: "3600",
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: data.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", input.userId);

  if (profileError) {
    await supabase.storage.from("profile-photos").remove([path]).catch(() => undefined);
    throw new Error(profileError.message);
  }

  return data.publicUrl;
}
