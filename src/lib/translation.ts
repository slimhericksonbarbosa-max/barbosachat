import { supabase } from "./supabase";

export async function translateConversationMessage(conversationId: string, text: string) {
  const { data, error } = await supabase.functions.invoke("translate-message", {
    body: { conversationId, text },
  });
  if (error) throw new Error(error.message || "Não foi possível traduzir a mensagem.");
  if (data?.error) throw new Error(String(data.error));
  if (typeof data?.translatedText !== "string") throw new Error("O serviço não devolveu uma tradução válida.");
  return data.translatedText as string;
}
