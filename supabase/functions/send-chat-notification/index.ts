import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const isExpoPushToken = (value: string) =>
  /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(value);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing server configuration or user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const jwt = authorization.slice("Bearer ".length);
    const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Invalid user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const conversationId = payload?.conversationId;
    const messageId = payload?.messageId;
    if (!isUuid(conversationId) || !isUuid(messageId)) {
      return new Response(JSON.stringify({ error: "Invalid conversation or message identifier" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: message, error: messageError } = await admin
      .from("messages")
      .select("id, conversation_id, sender_id, message_type")
      .eq("id", messageId)
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (messageError) throw messageError;
    if (!message || message.sender_id !== authData.user.id) {
      return new Response(JSON.stringify({ error: "Message not found or sender mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: members, error: membersError } = await admin
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId);
    if (membersError) throw membersError;

    const recipientIds = (members ?? [])
      .map((member) => member.user_id)
      .filter((userId) => userId !== authData.user.id);

    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "No recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: tokens, error: tokensError }, { data: senderProfile }, { data: conversation }] =
      await Promise.all([
        admin.from("push_tokens").select("expo_push_token").in("user_id", recipientIds),
        admin.from("profiles").select("display_name").eq("id", authData.user.id).maybeSingle(),
        admin.from("conversations").select("title, is_group").eq("id", conversationId).maybeSingle(),
      ]);

    if (tokensError) throw tokensError;
    const validTokens = (tokens ?? [])
      .map((item) => item.expo_push_token)
      .filter((token): token is string => typeof token === "string" && isExpoPushToken(token));

    if (validTokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "No registered devices" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const senderName = senderProfile?.display_name?.trim() || "Novo contacto";
    const title = conversation?.is_group
      ? (conversation.title?.trim() || "Grupo Barbosachat")
      : senderName;
    const bodyByType: Record<string, string> = {
      text: "Enviou-te uma mensagem",
      image: "Enviou-te uma fotografia",
      video: "Enviou-te um vídeo",
      audio: "Enviou-te um áudio",
      file: "Enviou-te um ficheiro",
    };
    const body = conversation?.is_group
      ? `${senderName}: ${bodyByType[message.message_type] || "Enviou-te uma mensagem"}`
      : (bodyByType[message.message_type] || "Enviou-te uma mensagem");

    let sent = 0;
    const invalidTokens: string[] = [];
    for (let i = 0; i < validTokens.length; i += 100) {
      const chunk = validTokens.slice(i, i + 100);
      const expoMessages = chunk.map((to) => ({
        to,
        title,
        body,
        sound: "default",
        priority: "high",
        channelId: "messages",
        data: { conversationId },
      }));

      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(expoMessages),
      });

      if (!response.ok) {
        console.error("Expo Push API returned", response.status);
        continue;
      }

      const result = await response.json();
      const tickets = Array.isArray(result?.data) ? result.data : [];
      tickets.forEach((ticket: { status?: string; details?: { error?: string } }, index: number) => {
        if (ticket.status === "ok") sent += 1;
        if (ticket.details?.error === "DeviceNotRegistered") invalidTokens.push(chunk[index]);
      });
    }

    if (invalidTokens.length > 0) {
      await admin.from("push_tokens").delete().in("expo_push_token", invalidTokens);
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-chat-notification failed", error);
    return new Response(JSON.stringify({ error: "Could not send chat notification" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
