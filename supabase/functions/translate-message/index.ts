import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const encoder = new TextEncoder();
function splitIntoChunks(text: string, maxBytes = 450): string[] {
  const words = text.match(/\S+\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    if (encoder.encode(current + word).length <= maxBytes) {
      current += word;
      continue;
    }
    if (current) chunks.push(current);
    current = "";
    for (const char of word) {
      if (encoder.encode(current + char).length > maxBytes && current) {
        chunks.push(current);
        current = "";
      }
      current += char;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function translateChunk(text: string, target: string): Promise<string> {
  const params = new URLSearchParams({
    q: text,
    langpair: `autodetect|${target}`,
    mt: "1",
  });
  const response = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`, {
    method: "GET",
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`O serviço gratuito respondeu com o código ${response.status}.`);
  }
  const result = await response.json();
  if (Number(result?.responseStatus) !== 200) {
    const detail = typeof result?.responseDetails === "string" ? result.responseDetails : "Resposta inválida do serviço.";
    // MyMemory reports this when autodetection finds the text is already
    // in the requested language. In that case the correct translation is
    // the original text, not a failed request.
    if (detail.toUpperCase().includes("PLEASE SELECT TWO DISTINCT LANGUAGES")) {
      return text;
    }
    throw new Error(detail);
  }
  const translated = result?.responseData?.translatedText;
  if (typeof translated !== "string" || !translated.trim()) {
    throw new Error("O serviço gratuito não devolveu uma tradução válida.");
  }
  return translated;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization || !supabaseUrl || !anonKey) return json({ error: "Sessão inválida." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Inicia sessão para traduzir mensagens." }, 401);

  let body: { conversationId?: string; text?: string };
  try { body = await req.json(); } catch { return json({ error: "Pedido inválido." }, 400); }
  const conversationId = body.conversationId;
  const messageText = typeof body.text === "string" ? body.text.trim() : "";
  if (!conversationId || typeof conversationId !== "string" || !messageText || encoder.encode(messageText).length > 10000) {
    return json({ error: "Mensagem inválida ou demasiado longa." }, 400);
  }

  const [{ data: profile, error: profileError }, { data: membership, error: memberError }] = await Promise.all([
    userClient.from("profiles").select("preferred_language").eq("id", authData.user.id).maybeSingle(),
    userClient.from("conversation_members").select("conversation_id").eq("conversation_id", conversationId).eq("user_id", authData.user.id).maybeSingle(),
  ]);
  if (profileError || memberError) return json({ error: "Não foi possível validar a conversa." }, 403);
  if (!membership || !profile) return json({ error: "Não tens acesso a esta conversa." }, 403);

  const target = typeof profile.preferred_language === "string" ? profile.preferred_language : "pt";
  if (!["pt", "en", "es", "fr", "ar", "zh"].includes(target)) return json({ error: "Idioma de destino não suportado." }, 400);

  try {
    const chunks = splitIntoChunks(messageText);
    const translatedChunks: string[] = [];
    for (const chunk of chunks) translatedChunks.push(await translateChunk(chunk, target));
    return json({ translatedText: translatedChunks.join(""), targetLanguage: target, provider: "MyMemory" });
  } catch (error) {
    console.error("MyMemory translation failed", error);
    const detail = error instanceof Error ? error.message : "Erro desconhecido.";
    return json({ error: `A tradução gratuita falhou: ${detail}` }, 502);
  }
});
