import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

function getEasProjectId(): string | null {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

export async function registerCurrentDeviceForPush(userId: string): Promise<string> {
  if (!Device.isDevice) {
    throw new Error("As notificações push precisam de um dispositivo físico.");
  }
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    throw new Error("As notificações push estão disponíveis apenas em iOS e Android.");
  }

  const projectId = getEasProjectId();
  if (!projectId) {
    throw new Error("A configuração EAS do Barbosachat ainda precisa de um ID de projeto.");
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Mensagens",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0B6B4B",
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted ||
    current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted ||
      requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }

  if (!granted) {
    throw new Error("A autorização para notificações foi recusada nas definições do telemóvel.");
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.from("push_tokens").upsert(
    {
      expo_push_token: token,
      user_id: userId,
      platform: Platform.OS,
      device_name: Device.deviceName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "expo_push_token" },
  );

  if (error) throw new Error(error.message);
  return token;
}

export async function unregisterCurrentDeviceFromPush(userId: string): Promise<void> {
  const projectId = getEasProjectId();
  if (!projectId) return;

  const permission = await Notifications.getPermissionsAsync();
  const granted = permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!granted) return;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase
    .from("push_tokens")
    .delete()
    .eq("expo_push_token", token)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function notifyChatRecipients(conversationId: string, messageId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("send-chat-notification", {
    body: { conversationId, messageId },
  });
  if (error) {
    // Message delivery must not fail because a push provider is temporarily unavailable.
    console.warn("Barbosachat push notification failed:", error.message);
  }
}
