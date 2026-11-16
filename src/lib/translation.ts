import { supabase } from "./supabase";

export async function translateConversationMessage(conversationId: string, text: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("translate-message", {
    body: { conversationId, text },
  });

  if (error) {
    let detail = "";
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json();
        if (typeof payload?.error === "string") detail = payload.error;
      } catch {
        // Keep the SDK message if the error body is not JSON.
      }
    }
    throw new Error(detail || error.message || "Não foi possível traduzir a mensagem.");
  }
  if (data?.error) throw new Error(String(data.error));
  if (typeof data?.translatedText !== "string" || !data.translatedText.trim()) {
    throw new Error("O serviço não devolveu uma tradução válida.");
  }
  return data.translatedText;
}
