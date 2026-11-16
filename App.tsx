import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
} from "expo-audio";
import { File } from "expo-file-system";
import { isSupabaseConfigured, supabase } from "./src/lib/supabase";
import { createConversation, listContacts, listMyConversations, listMessages, listPendingConversationInvites, recordMessagesAsRead, respondToConversationInvite, sendMediaMessage, sendTextMessage, subscribeToMessages, subscribeToReadReceipts, type PendingConversationInvite } from "./src/lib/chat";
import { createChatMediaUrl, deleteChatMedia, uploadChatMedia } from "./src/lib/media";
import { createStatusMediaUrl, listActiveStatuses, listStatusViewers, publishStatus, publishTextStatus, recordStatusView, type StatusUpdate, type StatusViewer } from "./src/lib/status";
import { translateConversationMessage } from "./src/lib/translation";
import * as Notifications from "expo-notifications";
import {
  registerCurrentDeviceForPush,
  unregisterCurrentDeviceFromPush,
} from "./src/lib/notifications";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Modal,
  Image,
} from "react-native";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

type ChatMessage = {
  id: string;
  text: string;
  time: string;
  mine: boolean;
  mediaPath?: string;
  mediaName?: string;
  mediaKind?: "image" | "video" | "audio" | "file";
  read?: boolean;
};

type Conversation = {
  id: string;
  name: string;
  message: string;
  time: string;
  unread?: number;
  color: string;
  messages: ChatMessage[];
};

const LANGUAGE_OPTIONS = [
  { code: "pt", label: "Português" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
  { code: "zh", label: "中文" },
] as const;

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    name: "Bem-vindo ao Barbosachat",
    message: "O teu espaço para conversar começa aqui.",
    time: "Agora",
    unread: 1,
    color: "#D9F3E8",
    messages: [
      { id: "m1", text: "Bem-vindo ao Barbosachat! Estamos felizes por te receber.", time: "09:00", mine: false },
      { id: "m2", text: "Obrigado! Vamos conversar.", time: "09:02", mine: true },
    ],
  },
  {
    id: "2",
    name: "Equipa Barbosachat",
    message: "Estamos a preparar novidades!",
    time: "Ontem",
    color: "#E8E8FF",
    messages: [
      { id: "m3", text: "Estamos a preparar novidades para ti!", time: "Ontem", mine: false },
    ],
  },
];

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return {
      error: error instanceof Error ? error.message : "Erro inesperado ao abrir o Barbosachat.",
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Barbosachat render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F6FBF8", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: "#0B6B4B", fontSize: 26, fontWeight: "800", marginBottom: 12 }}>Barbosachat</Text>
          <Text style={{ color: "#B42318", fontSize: 16, fontWeight: "700", marginBottom: 8 }}>Não foi possível abrir o aplicativo.</Text>
          <Text selectable style={{ color: "#27352D", fontSize: 13, lineHeight: 20 }}>{this.state.error}</Text>
          <Text style={{ color: "#718078", fontSize: 12, marginTop: 18 }}>Envia esta mensagem ao suporte para corrigirmos o problema.</Text>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return <AppErrorBoundary><AppContent /></AppErrorBoundary>;
}

function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [tab, setTab] = useState<"Conversas" | "Estados" | "Contactos" | "Definições">("Conversas");
  const [statuses, setStatuses] = useState<StatusUpdate[]>([]);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusNotice, setStatusNotice] = useState("");
  const [statusText, setStatusText] = useState("");
  const [showTextStatus, setShowTextStatus] = useState(false);
  const [viewingStatus, setViewingStatus] = useState<StatusUpdate | null>(null);
  const [viewingStatusUrl, setViewingStatusUrl] = useState<string | null>(null);
  const [statusProgress, setStatusProgress] = useState(0);
  const [statusViewers, setStatusViewers] = useState<StatusViewer[]>([]);
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(true);
  const [readReceiptsReady, setReadReceiptsReady] = useState(false);
  const [search, setSearch] = useState("");
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState("pt");
  const [preferenceLoading, setPreferenceLoading] = useState(false);
  const [languageNotice, setLanguageNotice] = useState("");
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [translationNotice, setTranslationNotice] = useState("");
  const translatingMessageKeys = useRef(new Set<string>());
  const [conversations, setConversations] = useState(INITIAL_CONVERSATIONS);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const audioPlayer = useAudioPlayer(null);
  const [chatError, setChatError] = useState("");
  const [contacts, setContacts] = useState<{ id: string; display_name: string; username: string | null }[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingConversationInvite[]>([]);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user.id) {
      setStatuses([]);
      return;
    }
    let cancelled = false;
    const refreshStatuses = async () => {
      try {
        const rows = await listActiveStatuses();
        if (!cancelled) setStatuses(rows.filter((status) => new Date(status.expires_at).getTime() > Date.now()));
      } catch (error) {
        if (!cancelled) setStatusNotice(error instanceof Error ? error.message : "Não foi possível carregar os estados.");
      }
    };
    void refreshStatuses();
    // Recheck expiration while the app remains open, and after it returns
    // from the background (the first tick runs as soon as JS resumes).
    const expiryRefresh = setInterval(() => {
      setStatuses((current) => current.filter((status) => new Date(status.expires_at).getTime() > Date.now()));
      void refreshStatuses();
    }, 30 * 1000);
    return () => {
      cancelled = true;
      clearInterval(expiryRefresh);
    };
  }, [session?.user.id]);

  useEffect(() => {
    if (!viewingStatus) return;
    if (new Date(viewingStatus.expires_at).getTime() <= Date.now()) {
      setViewingStatus(null);
      setViewingStatusUrl(null);
      setStatuses((current) => current.filter((status) => status.id !== viewingStatus.id));
    }
  }, [viewingStatus, statuses]);

  const publishNewStatus = async () => {
    if (!session?.user.id || statusBusy) return;
    setStatusBusy(true);
    setStatusNotice("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error("Permite o acesso às fotografias para publicar um estado.");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const mediaType = asset.type === "video" ? "video" : "image";
      const contentType = asset.mimeType || (mediaType === "video" ? "video/mp4" : "image/jpeg");
      let fileData: ArrayBuffer | Uint8Array;
      if (Platform.OS === "web") {
        const response = await fetch(asset.uri);
        if (!response.ok) throw new Error("Não foi possível ler o ficheiro selecionado.");
        const blob = await response.blob();
        if (!blob.size || blob.size > 50 * 1024 * 1024) throw new Error("O ficheiro deve ter entre 1 byte e 50 MB.");
        fileData = await blob.arrayBuffer();
      } else {
        const pickedFile = new File(asset.uri);
        if (!pickedFile.exists) throw new Error("Não foi possível ler o ficheiro selecionado.");
        if (!pickedFile.size || pickedFile.size > 50 * 1024 * 1024) throw new Error("O ficheiro deve ter entre 1 byte e 50 MB.");
        fileData = await pickedFile.bytes();
      }
      await publishStatus({
        userId: session.user.id,
        fileData,
        fileName: asset.fileName || (mediaType === "video" ? "estado.mp4" : "estado.jpg"),
        contentType,
        mediaType,
      });
      const rows = await listActiveStatuses();
      setStatuses(rows);
      setStatusNotice("Estado publicado. Ficará disponível durante 24 horas.");
    } catch (error) {
      setStatusNotice(error instanceof Error ? error.message : "Não foi possível publicar o estado.");
    } finally {
      setStatusBusy(false);
    }
  };

  const publishWrittenStatus = async () => {
    if (!session?.user.id || statusBusy) return;
    setStatusBusy(true);
    setStatusNotice("");
    try {
      await publishTextStatus({ userId: session.user.id, text: statusText });
      setStatusText("");
      setShowTextStatus(false);
      const rows = await listActiveStatuses();
      setStatuses(rows);
      setStatusNotice("Estado de texto publicado. Ficará disponível durante 24 horas.");
    } catch (error) {
      setStatusNotice(error instanceof Error ? error.message : "Não foi possível publicar o estado.");
    } finally {
      setStatusBusy(false);
    }
  };

  const openStatus = async (status: StatusUpdate) => {
    setStatusProgress(0);
    setViewingStatus(status);
    setStatusViewers([]);
    try {
      setViewingStatusUrl(status.media_path ? await createStatusMediaUrl(status.media_path) : null);
    } catch (error) {
      setViewingStatus(null);
      setStatusNotice(error instanceof Error ? error.message : "Não foi possível abrir este estado.");
      return;
    }
    if (status.user_id === session?.user.id) {
      try {
        setStatusViewers(await listStatusViewers(status.id));
      } catch (error) {
        setStatusNotice(error instanceof Error ? error.message : "Não foi possível carregar quem viu este estado.");
      }
    } else if (session?.user.id && readReceiptsReady && readReceiptsEnabled) {
      void recordStatusView(status.id, session.user.id)
        .catch((error) => console.warn("Could not record status view:", error));
    }
  };

  useEffect(() => {
    if (!viewingStatus || viewingStatus.user_id !== session?.user.id) return;
    const channel = supabase
      .channel("status-views:" + viewingStatus.id)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "status_views",
        filter: "status_id=eq." + viewingStatus.id,
      }, () => {
        void listStatusViewers(viewingStatus.id)
          .then(setStatusViewers)
          .catch((error) => console.warn("Could not refresh status viewers:", error));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [viewingStatus?.id, viewingStatus?.user_id, session?.user.id]);

  const statusGroups = useMemo(() => {
    const grouped = new Map<string, StatusUpdate[]>();
    const activeStatuses = statuses.filter((status) => new Date(status.expires_at).getTime() > Date.now());
    for (const status of activeStatuses) grouped.set(status.user_id, [...(grouped.get(status.user_id) ?? []), status]);
    return Array.from(grouped.entries()).map(([userId, items]) => ({
      userId,
      items: items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    })).sort((a, b) => a.userId === session?.user.id ? -1 : b.userId === session?.user.id ? 1 : 0);
  }, [statuses, session?.user.id]);

  const showNextStatus = (direction: -1 | 1) => {
    if (!viewingStatus) return;
    const sequence = statusGroups.flatMap((group) => group.items);
    const index = sequence.findIndex((item) => item.id === viewingStatus.id);
    const next = sequence[index + direction];
    if (next) void openStatus(next);
    else if (direction > 0) {
      setViewingStatus(null);
      setViewingStatusUrl(null);
      setStatusProgress(0);
    }
  };

  useEffect(() => {
    if (!viewingStatus) {
      setStatusProgress(0);
      return;
    }
    const duration = viewingStatus.media_type === "video" ? 15000 : 7000;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      setStatusProgress(progress);
      if (progress >= 1) {
        clearInterval(timer);
        showNextStatus(1);
      }
    }, 80);
    return () => clearInterval(timer);
  }, [viewingStatus?.id, statusGroups]);

  useEffect(() => {
    if (!session?.user.id) {
      setPendingInvites([]);
      return;
    }
    let cancelled = false;
    const loadInvites = async () => {
      try {
        const rows = await listPendingConversationInvites(session.user.id);
        if (!cancelled) setPendingInvites(rows);
      } catch (error) {
        if (!cancelled) setChatError(error instanceof Error ? error.message : "Não foi possível carregar os convites.");
      }
    };
    void loadInvites();
    return () => { cancelled = true; };
  }, [session?.user.id]);

  const [groupMode, setGroupMode] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [groupBusy, setGroupBusy] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [notificationsNotice, setNotificationsNotice] = useState("");

  useEffect(() => {
    if (!session?.user.id) {
      setNotificationsEnabled(false);
      return;
    }
    let cancelled = false;
    void supabase
      .from("push_tokens")
      .select("expo_push_token")
      .eq("user_id", session.user.id)
      .then(({ data, error }) => {
        if (!cancelled && !error) setNotificationsEnabled((data ?? []).length > 0);
      });
    return () => { cancelled = true; };
  }, [session?.user.id]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const openConversationFromNotification = (conversationId: unknown) => {
      if (typeof conversationId !== "string") return;
      setActiveConversationId(conversationId);
      setTab("Conversas");
    };

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      openConversationFromNotification(
        lastResponse.notification.request.content.data?.conversationId
      );
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openConversationFromNotification(
        response.notification.request.content.data?.conversationId
      );
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setAuthMode("login");
        setAuthError("");
        setAuthNotice("Link validado. Escolhe uma nova palavra-passe.");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleRecoveryUrl = async (url: string | null) => {
      if (!url) return;
      try {
        const rawParams = url.includes("#")
          ? url.split("#")[1]
          : url.split("?")[1] || "";
        const params = new URLSearchParams(rawParams);
        const code = params.get("code");
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          return;
        }

        if (type === "recovery" || url.includes("reset-password")) {
          setRecoveryMode(true);
          setAuthMode("login");
          setPassword("");
          setRecoveryPassword("");
          setAuthError("");
          setAuthNotice("Link validado. Escolhe uma nova palavra-passe.");
        }
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Não foi possível validar o link de recuperação.");
      }
    };

    void Linking.getInitialURL().then(handleRecoveryUrl);
    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleRecoveryUrl(url);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;
    let cancelled = false;
    const loadPreferences = async () => {
      setPreferenceLoading(true);
      setReadReceiptsReady(false);
      const { data, error } = await supabase
        .from("profiles")
        .select("translation_mode, preferred_language, read_receipts_enabled")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!cancelled && !error && data) {
        setTranslationEnabled(data.translation_mode === "automatic");
        setPreferredLanguage(data.preferred_language || "pt");
        setReadReceiptsEnabled(data.read_receipts_enabled !== false);
      } else if (!cancelled) {
        setReadReceiptsEnabled(false);
      }
      if (!cancelled) {
        setReadReceiptsReady(true);
        setPreferenceLoading(false);
      }
    };
    void loadPreferences();
    return () => { cancelled = true; };
  }, [session?.user.id]);

  useEffect(() => {
    const currentConversation = conversations.find((item) => item.id === activeConversationId);
    if (!translationEnabled || !session?.user.id || !activeConversationId || !currentConversation) return;
    const pending = currentConversation.messages.filter((message) =>
      !message.mine && !message.mediaPath && message.text.trim().length > 0
    );
    for (const message of pending) {
      const cacheKey = message.id + ":" + preferredLanguage;
      if (translatedMessages[cacheKey] || translatingMessageKeys.current.has(cacheKey)) continue;
      translatingMessageKeys.current.add(cacheKey);
      void translateConversationMessage(activeConversationId, message.text)
        .then((translatedText) => {
          setTranslatedMessages((current) => ({ ...current, [cacheKey]: translatedText }));
          setTranslationNotice("");
        })
        .catch((error) => {
          setTranslationNotice(error instanceof Error ? error.message : "Não foi possível traduzir esta mensagem.");
        })
        .finally(() => translatingMessageKeys.current.delete(cacheKey));
    }
  }, [translationEnabled, session?.user.id, activeConversationId, conversations, preferredLanguage, translatedMessages]);

  useEffect(() => {
    if (!session?.user.id) return;
    let cancelled = false;
    const loadConversations = async () => {
      setChatLoading(true);
      setChatError("");
      try {
        const rows = await listMyConversations(session.user.id);
        if (cancelled) return;
        setConversations(rows.map((row) => {
          const last = row.last_message;
          return {
            id: row.id,
            name: row.title || (row.is_group ? "Grupo" : row.other_member?.display_name || (row.other_member?.username ? "@"+row.other_member.username : "Nova conversa")),
            message: last?.body || "Ainda sem mensagens",
            time: last ? new Date(last.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
            color: row.is_group ? "#E8E8FF" : "#D9F3E8",
            messages: [],
          };
        }));
      } catch (error) {
        if (!cancelled) setChatError(error instanceof Error ? error.message : "Não foi possível carregar as conversas.");
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    };
    void loadConversations();
    return () => { cancelled = true; };
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) return;
    let cancelled = false;
    const loadContacts = async () => {
      try {
        const rows = await listContacts(session.user.id);
        if (!cancelled) setContacts(rows.map((profile) => ({
          id: profile.id,
          display_name: profile.display_name || profile.username || "Utilizador Barbosachat",
          username: profile.username,
        })));
      } catch (error) {
        if (!cancelled) setChatError(error instanceof Error ? error.message : "Não foi possível carregar os contactos.");
      }
    };
    void loadContacts();
    return () => { cancelled = true; };
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user.id || !activeConversationId) return;
    let cancelled = false;
    const channel = subscribeToMessages(activeConversationId, (stored) => {
      if (stored.sender_id === session.user.id) return;
      const incoming: ChatMessage = {
        id: stored.id,
        text: stored.body,
        time: new Date(stored.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mine: false,
        mediaPath: stored.media_path || undefined,
        mediaName: stored.media_name || undefined,
        mediaKind: stored.message_type === "text" ? undefined : stored.message_type,
      };
      setConversations((current) => current.map((conversation) =>
        conversation.id === activeConversationId && !conversation.messages.some((item) => item.id === incoming.id)
          ? { ...conversation, messages: [...conversation.messages, incoming], message: incoming.text, time: "Agora" }
          : conversation
      ));
      if (readReceiptsReady && readReceiptsEnabled) {
        void recordMessagesAsRead([stored.id], session.user.id)
          .catch((error) => console.warn("Could not record incoming message read:", error));
      }
    });
    const loadHistory = async () => {
      setChatLoading(true);
      setChatError("");
      try {
        const rows = await listMessages(activeConversationId);
        if (cancelled) return;
        if (readReceiptsReady && readReceiptsEnabled) {
          void recordMessagesAsRead(rows.filter((row) => row.sender_id !== session.user.id).map((row) => row.id), session.user.id)
            .catch((error) => console.warn("Could not record message reads:", error));
        }
        setConversations((current) => current.map((conversation) => conversation.id === activeConversationId
          ? (() => {
              const history = rows.map((row) => ({
                id: row.id,
                text: row.body,
                time: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                mine: row.sender_id === session.user.id,
                read: row.read_at != null,
                mediaPath: row.media_path || undefined,
                mediaName: row.media_name || undefined,
                mediaKind: row.message_type === "text" ? undefined : row.message_type,
              }));
              const historyIds = new Set(history.map((message) => message.id));
              const realtimeArrivals = conversation.messages.filter((message) => !historyIds.has(message.id));
              return { ...conversation, messages: [...history, ...realtimeArrivals] };
            })()
          : conversation
        ));
      } catch (error) {
        if (!cancelled) setChatError(error instanceof Error ? error.message : "Não foi possível carregar as mensagens.");
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    };
    void loadHistory();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [activeConversationId, session?.user.id, readReceiptsEnabled, readReceiptsReady]);

  useEffect(() => {
    if (!session?.user.id) return;
    const channel = subscribeToReadReceipts((messageId) => {
      setConversations((current) => current.map((conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) => message.id === messageId ? { ...message, read: true } : message),
      })));
    });
    return () => { void supabase.removeChannel(channel); };
  }, [session?.user.id]);

  const requestPasswordReset = async () => {
    const cleanEmail = email.trim().toLowerCase();
    setAuthError("");
    setAuthNotice("");
    if (!cleanEmail) {
      setAuthError("Escreve primeiro o teu email para receberes o link de recuperação.");
      return;
    }
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: "barbosachat://reset-password",
      });
      if (error) throw error;
      setAuthNotice("Se o endereço estiver registado, receberás um link para definir uma nova palavra-passe.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Não foi possível enviar o link de recuperação.");
    } finally {
      setAuthBusy(false);
    }
  };

  const updateRecoveredPassword = async () => {
    setAuthError("");
    setAuthNotice("");
    if (recoveryPassword.length < 8) {
      setAuthError("A nova palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }
    if (recoveryPassword !== recoveryPasswordConfirm) {
      setAuthError("As palavras-passe não coincidem.");
      return;
    }
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: recoveryPassword });
      if (error) throw error;
      await supabase.auth.signOut();
      setRecoveryMode(false);
      setRecoveryPassword("");
      setRecoveryPasswordConfirm("");
      setPassword("");
      setAuthMode("login");
      setAuthNotice("Palavra-passe atualizada. Já podes iniciar sessão.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Não foi possível atualizar a palavra-passe.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleAuth = async () => {
    const cleanEmail = email.trim().toLowerCase();
    setAuthError("");
    setAuthNotice("");
    if (!cleanEmail || !password) {
      setAuthError("Preenche o email e a palavra-passe.");
      return;
    }
    if (password.length < 8) {
      setAuthError("A palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }
    setAuthBusy(true);
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: "barbosachat://auth/callback",
          },
        });
        if (error) throw error;
        if (!data.session) {
          setAuthNotice("Conta criada. Confirma o teu email através do link que enviámos para entrares.");
        } else {
          setAuthNotice("Conta criada com sucesso!");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Não foi possível concluir a operação.");
    } finally {
      setAuthBusy(false);
    }
  };

  const enablePushNotifications = async () => {
    if (!session?.user.id) return;
    setNotificationsBusy(true);
    setNotificationsNotice("");
    try {
      await registerCurrentDeviceForPush(session.user.id);
      setNotificationsEnabled(true);
      setNotificationsNotice("Notificações ativadas neste dispositivo.");
    } catch (error) {
      setNotificationsNotice(error instanceof Error ? error.message : "Não foi possível ativar as notificações.");
    } finally {
      setNotificationsBusy(false);
    }
  };

  const disablePushNotifications = async () => {
    if (!session?.user.id) return;
    setNotificationsBusy(true);
    setNotificationsNotice("");
    try {
      await unregisterCurrentDeviceFromPush(session.user.id);
      setNotificationsEnabled(false);
      setNotificationsNotice("Notificações desativadas neste dispositivo.");
    } catch (error) {
      setNotificationsNotice(error instanceof Error ? error.message : "Não foi possível desativar as notificações.");
    } finally {
      setNotificationsBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (session?.user.id) {
      try {
        await unregisterCurrentDeviceFromPush(session.user.id);
      } catch (error) {
        console.warn("Could not unregister this device's push token:", error);
      }
    }
    await supabase.auth.signOut();
  };

  const saveReadReceiptsPreference = async (enabled: boolean) => {
    if (!session?.user.id) return;
    const previous = readReceiptsEnabled;
    setReadReceiptsEnabled(enabled);
    setPreferenceLoading(true);
    const { error } = await supabase.from("profiles")
      .update({ read_receipts_enabled: enabled, updated_at: new Date().toISOString() })
      .eq("id", session.user.id);
    if (error) {
      setReadReceiptsEnabled(previous);
      setLanguageNotice("Não foi possível guardar a confirmação de leitura. Tenta novamente.");
    } else {
      setLanguageNotice(enabled ? "Confirmações de leitura ativadas." : "Confirmações de leitura desativadas.");
    }
    setPreferenceLoading(false);
  };

  const saveTranslationPreference = async (enabled: boolean) => {
    setTranslationEnabled(enabled);
    if (!session?.user.id) return;
    setPreferenceLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        translation_mode: enabled ? "automatic" : "manual",
        preferred_language: preferredLanguage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user.id);
    if (error) {
      setAuthError("Não foi possível guardar a preferência. Verifica a ligação.");
    }
    setPreferenceLoading(false);
  };

  const savePreferredLanguage = async (language: string) => {
    if (!session?.user.id || language === preferredLanguage) return;
    const previousLanguage = preferredLanguage;
    setPreferredLanguage(language);
    setPreferenceLoading(true);
    setLanguageNotice("");
    const { error } = await supabase
      .from("profiles")
      .update({ preferred_language: language, updated_at: new Date().toISOString() })
      .eq("id", session.user.id);
    if (error) {
      setPreferredLanguage(previousLanguage);
      setLanguageNotice("Não foi possível guardar o idioma. Tenta novamente.");
    } else {
      setLanguageNotice("Idioma preferido guardado na tua conta.");
    }
    setPreferenceLoading(false);
  };

  const sendPickedFile = async (
    uri: string,
    fileName: string,
    contentType: string,
    kind: "image" | "video" | "audio" | "file",
  ) => {
    if (!session?.user.id || !activeConversationId) return;
    setMediaBusy(true);
    setChatError("");
    let uploadedPath: string | undefined;
    try {
      // On web, Expo FileSystem's native File class can fail with
      // "this.validatePath is not a function". Browser picker URIs are read
      // with fetch; keep Expo File for native iOS/Android local URIs.
      let bytes: ArrayBuffer | Uint8Array;
      let detectedContentType = contentType;
      if (Platform.OS === "web") {
        const response = await fetch(uri);
        if (!response.ok) throw new Error("Não foi possível ler o ficheiro selecionado.");
        const blob = await response.blob();
        if (blob.size > 50 * 1024 * 1024) throw new Error("O ficheiro excede o limite de 50 MB.");
        if (!blob.size) throw new Error("O ficheiro está vazio.");
        bytes = await blob.arrayBuffer();
        detectedContentType = contentType || blob.type || "application/octet-stream";
      } else {
        const file = new File(uri);
        if (!file.exists) throw new Error("Não foi possível ler o ficheiro selecionado.");
        if (file.size > 50 * 1024 * 1024) throw new Error("O ficheiro excede o limite de 50 MB.");
        bytes = await file.bytes();
        detectedContentType = contentType || file.type || "application/octet-stream";
      }
      const uploaded = await uploadChatMedia({
        conversationId: activeConversationId,
        userId: session.user.id,
        fileData: bytes,
        fileName,
        contentType: detectedContentType,
        kind,
      });
      uploadedPath = uploaded.path;
      const stored = await sendMediaMessage(activeConversationId, session.user.id, {
        path: uploaded.path,
        name: uploaded.originalName,
        contentType: uploaded.contentType,
        kind: uploaded.kind,
      });
      const message: ChatMessage = {
        id: stored.id,
        text: stored.body,
        time: new Date(stored.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mine: true,
        mediaPath: stored.media_path || undefined,
        mediaName: stored.media_name || undefined,
        mediaKind: stored.message_type === "text" ? undefined : stored.message_type,
      };
      const preview = kind === "image" ? "📷 Fotografia" : kind === "video" ? "🎬 Vídeo" : kind === "audio" ? "🎵 Áudio" : "📎 Ficheiro";
      setConversations((current) => current.map((conversation) =>
        conversation.id === activeConversationId
          ? { ...conversation, messages: [...conversation.messages, message], message: preview, time: "Agora" }
          : conversation
      ));
    } catch (error) {
      if (uploadedPath) await deleteChatMedia(uploadedPath).catch(() => undefined);
      setChatError(error instanceof Error ? error.message : "Não foi possível enviar o ficheiro.");
    } finally {
      setMediaBusy(false);
    }
  };

  const pickPhotoOrVideo = async () => {
    if (!session?.user.id || !activeConversationId) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setChatError("É necessária autorização para aceder às fotografias e vídeos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 120,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const kind = asset.type === "video" ? "video" : "image";
      const fallbackName = kind === "video" ? "video.mp4" : "fotografia.jpg";
      const contentType = asset.mimeType || (kind === "video" ? "video/mp4" : "image/jpeg");
      await sendPickedFile(asset.uri, asset.fileName || fallbackName, contentType, kind);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Não foi possível abrir a galeria.");
    }
  };

  const pickDocumentOrAudio = async () => {
    if (!session?.user.id || !activeConversationId) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const contentType = asset.mimeType || "application/octet-stream";
      const kind = contentType.startsWith("audio/") ? "audio" : "file";
      await sendPickedFile(asset.uri, asset.name, contentType, kind);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Não foi possível selecionar o ficheiro.");
    }
  };

  const startVoiceRecording = async () => {
    if (!session?.user.id || !activeConversationId) return;
    try {
      setChatError("");
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setChatError("Autoriza o acesso ao microfone para gravares uma mensagem de voz.");
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Não foi possível iniciar a gravação.");
    }
  };

  const stopAndSendVoiceMessage = async () => {
    if (!session?.user.id || !activeConversationId) return;
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const recordingUri = audioRecorder.uri;
      if (!recordingUri) throw new Error("A gravação não foi guardada. Tenta novamente.");
      await sendPickedFile(recordingUri, "mensagem-de-voz.m4a", "audio/mp4", "audio");
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Não foi possível enviar a mensagem de voz.");
    }
  };

  const openMedia = async (item: ChatMessage) => {
    if (!item.mediaPath) return;
    try {
      const url = await createChatMediaUrl(item.mediaPath);
      if (item.mediaKind === "audio") {
        audioPlayer.replace(url);
        audioPlayer.play();
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Não foi possível abrir o ficheiro.");
    }
  };

  const activeConversation = conversations.find((item) => item.id === activeConversationId);

  const filteredConversations = useMemo(
    () => conversations.filter((item) =>
      (item.name + " " + item.message).toLowerCase().includes(search.toLowerCase())
    ),
    [conversations, search]
  );

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !activeConversationId) return;
    if (session?.user.id) {
      setChatError("");
      try {
        const stored = await sendTextMessage(activeConversationId, session.user.id, text);
        const message: ChatMessage = {
          id: stored.id,
          text: stored.body,
          time: new Date(stored.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          mine: true,
        };
        setConversations((current) => current.map((conversation) =>
          conversation.id === activeConversationId
            ? { ...conversation, messages: conversation.messages.some((item) => item.id === message.id) ? conversation.messages : [...conversation.messages, message], message: text, time: "Agora", unread: 0 }
            : conversation
        ));
        setDraft("");
      } catch (error) {
        setChatError(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
      }
      return;
    }

    const now = new Date();
    const message: ChatMessage = {
      id: String(Date.now()),
      text,
      time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      mine: true,
    };
    setConversations((current) => current.map((conversation) =>
      conversation.id === activeConversationId
        ? { ...conversation, messages: [...conversation.messages, message], message: text, time: "Agora", unread: 0 }
        : conversation
    ));
    setDraft("");
  };

  const startConversation = async (contactId: string, contactName: string) => {
    if (!session?.user.id) return;
    setChatError("");
    try {
      const conversationId = await createConversation(session.user.id, [contactId]);
      setConversations((current) => current.some((item) => item.id === conversationId)
        ? current
        : [{
            id: conversationId,
            name: contactName,
            message: "Ainda sem mensagens",
            time: "",
            color: "#D9F3E8",
            messages: [],
          }, ...current]);
      setActiveConversationId(conversationId);
      setTab("Conversas");
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Não foi possível iniciar a conversa.");
    }
  };

  const createGroupChat = async () => {
    if (!session?.user.id || selectedContactIds.length < 2) return;
    setGroupBusy(true);
    setChatError("");
    try {
      const title = groupTitle.trim() || "Grupo Barbosachat";
      const conversationId = await createConversation(session.user.id, selectedContactIds, {
        title,
        isGroup: true,
      });
      setConversations((current) => [{
        id: conversationId,
        name: title,
        message: "Grupo criado. Convites enviados; aguarda a aceitação dos participantes.",
        time: "",
        color: "#E8E8FF",
        messages: [],
      }, ...current.filter((item) => item.id !== conversationId)]);
      setActiveConversationId(conversationId);
      setTab("Conversas");
      setGroupMode(false);
      setGroupTitle("");
      setSelectedContactIds([]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Não foi possível criar o grupo.");
    } finally {
      setGroupBusy(false);
    }
  };


  const handleConversationInvite = async (invite: PendingConversationInvite, accept: boolean) => {
    setInviteBusyId(invite.id);
    setChatError("");
    try {
      const conversationId = await respondToConversationInvite(invite.id, accept);
      setPendingInvites((current) => current.filter((item) => item.id !== invite.id));
      if (accept && session?.user.id) {
        const rows = await listMyConversations(session.user.id);
        setConversations(rows.map((row) => ({
          id: row.id,
          name: row.title || (row.is_group ? "Grupo" : row.other_member?.display_name || (row.other_member?.username ? "@" + row.other_member.username : "Nova conversa")),
          message: row.last_message?.body || "Ainda sem mensagens",
          time: row.last_message ? new Date(row.last_message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
          color: row.is_group ? "#E8E8FF" : "#D9F3E8",
          messages: [],
        })));
        setActiveConversationId(conversationId);
        setTab("Conversas");
      }
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Não foi possível responder ao convite.");
    } finally {
      setInviteBusyId(null);
    }
  };

  const openConversation = (id: string) => {
    setActiveConversationId(id);
    setConversations((current) =>
      current.map((item) => item.id === id ? { ...item, unread: 0 } : item)
    );
  };

  if (isSupabaseConfigured && !authReady) {
    return (
      <SafeAreaView style={[styles.safe, styles.authScreen]}>
        <StatusBar barStyle="dark-content" backgroundColor="#F6FBF8" />
        <Text style={styles.brand}>Barbosachat</Text>
        <Text style={styles.empty}>A verificar a tua sessão...</Text>
      </SafeAreaView>
    );
  }

  if (isSupabaseConfigured && (!session || recoveryMode)) {
    return (
      <SafeAreaView style={[styles.safe, styles.authScreen]}>
        <StatusBar barStyle="dark-content" backgroundColor="#F6FBF8" />
        <View style={styles.authCard}>
          <View style={styles.authLogo}><Text style={styles.authLogoText}>B</Text></View>
          <Text style={styles.brand}>Barbosachat</Text>
          <Text style={styles.subtitle}>Perto de quem importa.</Text>
          <Text style={styles.authHeading}>
            {recoveryMode ? "Define uma nova palavra-passe" : authMode === "login" ? "Bem-vindo de volta" : "Cria a tua conta"}
          </Text>
          {!recoveryMode && authMode === "signup" && (
            <TextInput value={displayName} onChangeText={setDisplayName} placeholder="O teu nome"
              placeholderTextColor="#82938B" style={styles.authInput} autoCapitalize="words" />
          )}
          {!recoveryMode && (
            <TextInput value={email} onChangeText={setEmail} placeholder="Email"
              placeholderTextColor="#82938B" style={styles.authInput} keyboardType="email-address"
              autoCapitalize="none" autoComplete="email" />
          )}
          {!recoveryMode && (
            <TextInput value={password} onChangeText={setPassword}
              placeholder="Palavra-passe (mínimo 8 caracteres)" placeholderTextColor="#82938B"
              style={styles.authInput} secureTextEntry autoCapitalize="none" />
          )}
          {recoveryMode && (
            <>
              <TextInput value={recoveryPassword} onChangeText={setRecoveryPassword}
                placeholder="Nova palavra-passe (mínimo 8 caracteres)" placeholderTextColor="#82938B"
                style={styles.authInput} secureTextEntry autoCapitalize="none" />
              <TextInput value={recoveryPasswordConfirm} onChangeText={setRecoveryPasswordConfirm}
                placeholder="Confirmar nova palavra-passe" placeholderTextColor="#82938B"
                style={styles.authInput} secureTextEntry autoCapitalize="none" />
            </>
          )}
          {!!authError && <Text style={styles.authError}>{authError}</Text>}
          {!!authNotice && <Text style={styles.authNotice}>{authNotice}</Text>}
          <Pressable
            onPress={recoveryMode ? updateRecoveredPassword : handleAuth}
            disabled={authBusy}
            style={[styles.authButton, authBusy && styles.authButtonDisabled]}
          >
            <Text style={styles.authButtonText}>
              {authBusy ? "Aguarda..." : recoveryMode ? "Guardar nova palavra-passe" : authMode === "login" ? "Entrar" : "Criar conta"}
            </Text>
          </Pressable>
          {!recoveryMode && authMode === "login" && (
            <Pressable onPress={requestPasswordReset} disabled={authBusy}>
              <Text style={styles.authSwitch}>Esqueceste-te da palavra-passe?</Text>
            </Pressable>
          )}
          {recoveryMode ? (
            <Pressable onPress={() => { setRecoveryMode(false); setAuthError(""); setAuthNotice(""); }}>
              <Text style={styles.authSwitch}>Voltar ao início de sessão</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); setAuthNotice(""); }}>
              <Text style={styles.authSwitch}>{authMode === "login" ? "Ainda não tens conta? Criar conta" : "Já tens conta? Iniciar sessão"}</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6FBF8" />
      {activeConversation ? (
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={8}
        >
          <View style={styles.chatHeader}>
            <Pressable onPress={() => setActiveConversationId(null)} style={styles.backButton}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <View style={[styles.chatAvatar, { backgroundColor: activeConversation.color }]}>
              <Text style={styles.chatAvatarText}>{activeConversation.name.charAt(0)}</Text>
            </View>
            <View style={styles.chatHeaderCopy}>
              <Text numberOfLines={1} style={styles.chatHeaderName}>{activeConversation.name}</Text>
              <Text style={styles.onlineText}>{session ? "Mensagens em tempo real" : "Conversa demonstrativa"}</Text>
            </View>
          </View>

          {!!chatError && <Text style={styles.authError}>{chatError}</Text>}
          {chatLoading && <Text style={styles.languageNote}>A carregar mensagens...</Text>}
          <FlatList
            data={activeConversation.messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            ListEmptyComponent={<Text style={styles.empty}>Ainda não existem mensagens. Envia a primeira!</Text>}
            renderItem={({ item }) => (
              <View style={[styles.messageBubble, item.mine ? styles.myBubble : styles.theirBubble]}>
                {item.mediaPath ? (
                  <Pressable onPress={() => void openMedia(item)}>
                    <Text style={[styles.messageText, item.mine && styles.myMessageText]}>
                      {item.mediaKind === "image" ? "📷 Fotografia" : item.mediaKind === "video" ? "🎬 Vídeo" : item.mediaKind === "audio" ? "🎵 Áudio" : "📎 Ficheiro"}
                      {"\n"}{item.mediaName || item.text}
                      {"\n"}{item.mediaKind === "audio" ? "Toque para ouvir" : "Toque para abrir"}
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    <Text style={[styles.messageText, item.mine && styles.myMessageText]}>
                      {translatedMessages[item.id + ":" + preferredLanguage] || item.text}
                    </Text>
                    {!!translatedMessages[item.id + ":" + preferredLanguage] && (
                      <Text style={[styles.messageTime, { alignSelf: "flex-start" }]}>Tradução automática · Original: {item.text}</Text>
                    )}
                  </>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                  <Text style={[styles.messageTime, item.mine && styles.myMessageTime]}>{item.time}</Text>
                  {item.mine && <Text style={[styles.messageTime, item.mine && styles.myMessageTime, item.read && { color: "#58B7E8" }]}>{item.read ? "✓✓" : "✓"}</Text>}
                </View>
              </View>
            )}
          />
          {!!translationNotice && (
            <Text style={[styles.languageNote, { paddingHorizontal: 16, paddingVertical: 8 }]}>{translationNotice}</Text>
          )}

          {session && (
            <View style={styles.mediaActions}>
              <Pressable onPress={() => void pickPhotoOrVideo()} disabled={mediaBusy} style={styles.mediaButton}>
                <Text style={styles.mediaButtonText}>{mediaBusy ? "A enviar..." : "Foto/vídeo"}</Text>
              </Pressable>
              <Pressable onPress={() => void pickDocumentOrAudio()} disabled={mediaBusy} style={styles.mediaButton}>
                <Text style={styles.mediaButtonText}>Ficheiro/áudio</Text>
              </Pressable>
              <Pressable
                onPress={() => void (recorderState.isRecording ? stopAndSendVoiceMessage() : startVoiceRecording())}
                disabled={mediaBusy}
                style={[styles.mediaButton, recorderState.isRecording && { backgroundColor: "#FCE8E6" }]}
              >
                <Text style={[styles.mediaButtonText, recorderState.isRecording && { color: "#B42318" }]}>
                  {recorderState.isRecording
                    ? `Parar e enviar voz · ${Math.floor(recorderState.durationMillis / 1000)}s`
                    : "🎙 Gravar voz"}
                </Text>
              </Pressable>
            </View>
          )}
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Escreve uma mensagem..."
              placeholderTextColor="#82938B"
              style={styles.composerInput}
              multiline
            />
            <Pressable onPress={sendMessage} style={styles.sendButton} accessibilityRole="button">
              <Text style={styles.sendButtonText}>Enviar</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>Barbosachat</Text>
              <Text style={styles.subtitle}>Perto de quem importa.</Text>
            </View>
            <View style={styles.avatar}><Text style={styles.avatarText}>B</Text></View>
          </View>

          {tab === "Conversas" && (
            <View style={styles.content}>
              <Text style={styles.heading}>Mensagens</Text>
              {!!chatError && <Text style={styles.authError}>{chatError}</Text>}
              {session && chatLoading && <Text style={styles.languageNote}>A carregar conversas...</Text>}
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Pesquisar conversas"
                placeholderTextColor="#82938B"
                style={styles.search}
              />
              <FlatList
                data={filteredConversations}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<Text style={styles.empty}>Não encontrámos conversas.</Text>}
                renderItem={({ item }) => (
                  <Pressable style={styles.chatRow} onPress={() => openConversation(item.id)}>
                    <View style={[styles.chatAvatar, { backgroundColor: item.color }]}>
                      <Text style={styles.chatAvatarText}>{item.name.charAt(0)}</Text>
                    </View>
                    <View style={styles.chatCopy}>
                      <View style={styles.chatTitleRow}>
                        <Text style={styles.chatName}>{item.name}</Text>
                        <Text style={styles.time}>{item.time}</Text>
                      </View>
                      <View style={styles.chatTitleRow}>
                        <Text numberOfLines={1} style={styles.message}>{item.message}</Text>
                        {!!item.unread && <View style={styles.unread}><Text style={styles.unreadText}>{item.unread}</Text></View>}
                      </View>
                    </View>
                  </Pressable>
                )}
              />
            </View>
          )}

          {tab === "Estados" && (
            <View style={styles.content}>
              <View style={styles.groupHeader}>
                <Text style={styles.heading}>Estados</Text>
                <Pressable onPress={() => { setShowTextStatus(false); void publishNewStatus(); }} disabled={!session || statusBusy} style={[styles.mediaButton, statusBusy && styles.authButtonDisabled]}>
                  <Text style={styles.mediaButtonText}>{statusBusy ? "A publicar..." : "+ Foto/vídeo"}</Text>
                </Pressable>
              </View>
              <Text style={styles.settingDescription}>Partilha momentos com os teus contactos. Os estados desaparecem após 24 horas.</Text>
              {session && (
                <View style={styles.statusStrip}>
                  <Pressable style={styles.statusPerson} onPress={() => {
                    const mine = statusGroups.find((group) => group.userId === session.user.id);
                    if (mine?.items.length) void openStatus(mine.items[0]);
                    else setStatusNotice("Publica o teu primeiro estado usando o campo abaixo.");
                  }}>
                    <View style={styles.myStatusAvatarWrap}>
                      <View style={styles.myStatusAvatar}><Text style={styles.myStatusLetter}>{session.user.email?.charAt(0).toUpperCase() || "B"}</Text></View>
                      <View style={styles.statusAdd}><Text style={styles.statusAddText}>+</Text></View>
                    </View>
                    <Text numberOfLines={1} style={styles.statusPersonName}>O meu estado</Text>
                  </Pressable>
                  {statusGroups.filter((group) => group.userId !== session.user.id).map((group) => (
                    <Pressable key={group.userId} style={styles.statusPerson} onPress={() => void openStatus(group.items[0])}>
                      <View style={styles.statusRing}><View style={styles.statusAvatar}><Text style={styles.statusAvatarLetter}>B</Text></View></View>
                      <Text numberOfLines={1} style={styles.statusPersonName}>Contacto</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {session && (
                <View style={styles.groupComposer}>
                  <Text style={styles.settingTitle}>Publicar um estado de texto</Text>
                  <TextInput
                    value={statusText}
                    onChangeText={setStatusText}
                    placeholder="O que queres partilhar?"
                    placeholderTextColor="#82938B"
                    style={[styles.search, { minHeight: 90, textAlignVertical: "top" }]}
                    multiline
                    maxLength={700}
                  />
                  <View style={styles.groupHeader}>
                    <Text style={styles.languageNote}>{statusText.length}/700</Text>
                    <Pressable onPress={() => void publishWrittenStatus()} disabled={statusBusy || !statusText.trim()} style={[styles.authButton, { paddingHorizontal: 18, paddingVertical: 10 }, (statusBusy || !statusText.trim()) && styles.authButtonDisabled]}>
                      <Text style={styles.authButtonText}>{statusBusy ? "A publicar..." : "Publicar texto"}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              {!!statusNotice && <Text style={styles.languageNote}>{statusNotice}</Text>}
              {!session ? (
                <Text style={styles.empty}>Inicia sessão para ver e publicar estados.</Text>
              ) : statusGroups.length === 0 ? (
                <Text style={styles.empty}>Ainda não há estados ativos. Sê o primeiro a partilhar um momento!</Text>
              ) : (
                <Text style={styles.languageNote}>Toca num círculo para ver os estados desse contacto.</Text>
              )}
            </View>
          )}

          {tab === "Contactos" && (
            <View style={styles.content}>
              <View style={styles.groupHeader}>
                <Text style={styles.heading}>Contactos</Text>
                {session && (
                  <Pressable
                    onPress={() => {
                      setGroupMode(!groupMode);
                      setSelectedContactIds([]);
                      setGroupTitle("");
                    }}
                    style={styles.mediaButton}
                  >
                    <Text style={styles.mediaButtonText}>{groupMode ? "Cancelar" : "Novo grupo"}</Text>
                  </Pressable>
                )}
              </View>

              {session && pendingInvites.length > 0 && (
                <View style={styles.groupComposer}>
                  <Text style={styles.settingTitle}>Convites recebidos ({pendingInvites.length})</Text>
                  {pendingInvites.map((invite) => (
                    <View key={invite.id} style={styles.inviteRow}>
                      <View style={styles.chatCopy}>
                        <Text style={styles.chatName}>Convite para um grupo</Text>
                        <Text style={styles.message}>Recebido em {new Date(invite.created_at).toLocaleDateString()}</Text>
                      </View>
                      <Pressable onPress={() => void handleConversationInvite(invite, true)} disabled={inviteBusyId === invite.id} style={styles.inviteAccept}>
                        <Text style={styles.inviteAcceptText}>{inviteBusyId === invite.id ? "..." : "Aceitar"}</Text>
                      </Pressable>
                      <Pressable onPress={() => void handleConversationInvite(invite, false)} disabled={inviteBusyId === invite.id} style={styles.inviteDecline}>
                        <Text style={styles.inviteDeclineText}>Recusar</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              {groupMode && (
                <View style={styles.groupComposer}>
                  <TextInput
                    value={groupTitle}
                    onChangeText={setGroupTitle}
                    placeholder="Nome do grupo (opcional)"
                    placeholderTextColor="#82938B"
                    style={styles.search}
                    maxLength={60}
                  />
                  <Text style={styles.languageNote}>Seleciona pelo menos duas pessoas para criar o grupo.</Text>
                  <Pressable
                    onPress={() => void createGroupChat()}
                    disabled={groupBusy || selectedContactIds.length < 2}
                    style={[styles.authButton, (groupBusy || selectedContactIds.length < 2) && styles.authButtonDisabled]}
                  >
                    <Text style={styles.authButtonText}>
                      {groupBusy ? "A criar..." : `Criar grupo (${selectedContactIds.length})`}
                    </Text>
                  </Pressable>
                </View>
              )}
              {!!chatError && <Text style={styles.authError}>{chatError}</Text>}
              {!session ? (
                <Text style={styles.empty}>Inicia sessão para encontrar outros utilizadores.</Text>
              ) : (
                <FlatList
                  data={contacts}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.list}
                  ListEmptyComponent={<Text style={styles.empty}>Ainda não existem outros utilizadores registados.</Text>}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.chatRow,
                        groupMode && selectedContactIds.includes(item.id) && styles.groupSelectedRow,
                      ]}
                      onPress={() => groupMode
                        ? setSelectedContactIds((current) => current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id])
                        : void startConversation(item.id, item.display_name)}
                    >
                      <View style={[styles.chatAvatar, { backgroundColor: "#D9F3E8" }]}>
                        <Text style={styles.chatAvatarText}>{item.display_name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.chatCopy}>
                        <Text style={styles.chatName}>{item.display_name}</Text>
                        <Text style={styles.message}>{item.username ? "@"+item.username : "Utilizador Barbosachat"}</Text>
                      </View>
                      <Text style={styles.navTextActive}>
                        {groupMode
                          ? selectedContactIds.includes(item.id) ? "Selecionado" : "Selecionar"
                          : "Conversar"}
                      </Text>
                    </Pressable>
                  )}
                />
              )}
            </View>
          )}

          {tab === "Definições" && (
            <View style={styles.content}>
              <Text style={styles.heading}>Definições</Text>
              <View style={styles.settingCard}>
                <Text style={styles.settingTitle}>Tradução automática</Text>
                <Text style={styles.settingDescription}>Quando ativada, as mensagens de texto recebidas serão traduzidas para o teu idioma. A mensagem original continua guardada. A tradução usa um serviço externo.</Text>
                <Pressable
                  onPress={() => void saveTranslationPreference(!translationEnabled)}
                  style={[styles.toggle, translationEnabled && styles.toggleOn]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: translationEnabled }}
                >
                  <Text style={[styles.toggleText, translationEnabled && styles.toggleTextOn]}>
                    {translationEnabled ? "Automática ativada" : "Modo manual"}
                  </Text>
                </Pressable>
                <Text style={[styles.settingTitle, { marginTop: 20 }]}>Idioma preferido</Text>
                <Text style={styles.settingDescription}>Escolhe o idioma que pretendes usar nas traduções. Esta preferência é individual da tua conta.</Text>
                <View style={styles.languageOptions}>
                  {LANGUAGE_OPTIONS.map((language) => (
                    <Pressable
                      key={language.code}
                      onPress={() => void savePreferredLanguage(language.code)}
                      disabled={!session || preferenceLoading}
                      style={[styles.languageOption, preferredLanguage === language.code && styles.languageOptionSelected]}
                    >
                      <Text style={[styles.languageOptionText, preferredLanguage === language.code && styles.languageOptionTextSelected]}>
                        {language.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {!session && <Text style={styles.languageNote}>Inicia sessão para guardar a tua preferência.</Text>}
                {!!languageNotice && <Text style={styles.languageNote}>{languageNotice}</Text>}
                {!!translationNotice && <Text style={styles.languageNote}>{translationNotice}</Text>}
                {preferenceLoading && <Text style={styles.languageNote}>A guardar preferência...</Text>}
              </View>
              {session && (
                <View style={styles.settingCard}>
                  <Text style={styles.settingTitle}>Confirmações de leitura</Text>
                  <Text style={styles.settingDescription}>Quando desativadas, os outros não verão quando leste as mensagens nem quem viu os teus estados. Também deixarás de enviar recibos de leitura.</Text>
                  <Pressable
                    onPress={() => void saveReadReceiptsPreference(!readReceiptsEnabled)}
                    disabled={preferenceLoading || !readReceiptsReady}
                    style={[styles.toggle, readReceiptsEnabled && styles.toggleOn]}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: readReceiptsEnabled }}
                  >
                    <Text style={[styles.toggleText, readReceiptsEnabled && styles.toggleTextOn]}>
                      {readReceiptsEnabled ? "Confirmações ativadas" : "Confirmações desativadas"}
                    </Text>
                  </Pressable>
                </View>
              )}
              {session && (
                <View style={styles.settingCard}>
                  <Text style={styles.settingTitle}>Notificações</Text>
                  <Text style={styles.settingDescription}>
                    Recebe avisos quando alguém te envia uma mensagem, mesmo quando não estás a usar o Barbosachat.
                  </Text>
                  <Pressable
                    onPress={() => void (notificationsEnabled ? disablePushNotifications() : enablePushNotifications())}
                    disabled={notificationsBusy}
                    style={[styles.toggle, notificationsEnabled && styles.toggleOn]}
                  >
                    <Text style={[styles.toggleText, notificationsEnabled && styles.toggleTextOn]}>
                      {notificationsBusy ? "A atualizar..." : notificationsEnabled ? "Notificações ativadas" : "Ativar notificações"}
                    </Text>
                  </Pressable>
                  {!!notificationsNotice && <Text style={styles.languageNote}>{notificationsNotice}</Text>}
                  <Text style={styles.languageNote}>As notificações push exigem uma versão de desenvolvimento/produção e a configuração EAS do projeto.</Text>
                  <Pressable onPress={() => void handleSignOut()} style={styles.logoutButton}>
                    <Text style={styles.logoutText}>Terminar sessão</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          <View style={styles.bottomNav}>
            {(["Conversas", "Estados", "Contactos", "Definições"] as const).map((item) => (
              <Pressable key={item} onPress={() => setTab(item)} style={styles.navItem}>
                <Text style={[styles.navText, tab === item && styles.navTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      <Modal visible={!!viewingStatus} animationType="fade" onRequestClose={() => setViewingStatus(null)}>
        <View style={styles.statusViewer}>
          <View style={{ flexDirection: "row", gap: 4, paddingHorizontal: 14, paddingTop: 12 }}>
            {(() => {
              const sequence = statusGroups.flatMap((group) => group.items);
              const currentIndex = sequence.findIndex((item) => item.id === viewingStatus?.id);
              return sequence.filter((item, index) => index >= currentIndex).map((item, index) => (
                <View key={item.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "#64736C", overflow: "hidden" }}>
                  <View style={{ height: 3, width: index === 0 ? `${statusProgress * 100}%` : "0%", backgroundColor: "#FFFFFF" }} />
                </View>
              ));
            })()}
          </View>
          <View style={styles.statusViewerTop}>
            <Text style={styles.statusViewerText}>{viewingStatus?.user_id === session?.user.id ? "O meu estado" : "Estado de um contacto"}</Text>
            <Pressable onPress={() => setViewingStatus(null)}><Text style={styles.statusViewerClose}>×</Text></Pressable>
          </View>
          {viewingStatus?.media_type === "text" ? (
            <Text style={styles.statusViewerText}>{viewingStatus.caption}</Text>
          ) : viewingStatus?.media_type === "image" && viewingStatusUrl ? (
            <Image source={{ uri: viewingStatusUrl }} resizeMode="contain" style={{ width: "100%", height: "75%" }} />
          ) : viewingStatus?.media_type === "video" && viewingStatusUrl ? (
            <Pressable onPress={() => void Linking.openURL(viewingStatusUrl)}><Text style={styles.statusViewerButton}>Reproduzir vídeo</Text></Pressable>
          ) : (
            <Text style={styles.statusViewerText}>A carregar estado...</Text>
          )}
          {viewingStatus?.user_id === session?.user.id && (
            <View style={{ position: "absolute", bottom: 92, left: 20, right: 20, maxHeight: 110 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700", marginBottom: 5 }}>Visto por {statusViewers.length}</Text>
              <Text numberOfLines={3} style={{ color: "#FFFFFF", fontSize: 11 }}>
                {!readReceiptsEnabled ? "As confirmações de leitura estão desativadas." : statusViewers.map((viewer) => viewer.display_name).join(", ") || "Ainda ninguém visualizou este estado."}
              </Text>
            </View>
          )}
          <View style={{ position: "absolute", bottom: 42, left: 20, right: 20, flexDirection: "row", justifyContent: "space-between" }}>
            <Pressable onPress={() => showNextStatus(-1)}><Text style={styles.statusViewerButton}>Anterior</Text></Pressable>
            <Pressable onPress={() => showNextStatus(1)}><Text style={styles.statusViewerButton}>Seguinte</Text></Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6FBF8" },
  statusStrip: { flexDirection: "row", paddingVertical: 18, gap: 16, borderBottomWidth: 1, borderBottomColor: "#E5EEE9", marginBottom: 12 },
  statusPerson: { width: 68, alignItems: "center" },
  statusRing: { width: 62, height: 62, borderRadius: 31, borderWidth: 2.5, borderColor: "#20B978", alignItems: "center", justifyContent: "center", padding: 3 },
  statusAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#D9F3E8", alignItems: "center", justifyContent: "center" },
  statusAvatarLetter: { color: "#0B6B4B", fontSize: 20, fontWeight: "800" },
  myStatusAvatarWrap: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#E4EAE6", alignItems: "center", justifyContent: "center", position: "relative" },
  myStatusAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#0B6B4B", alignItems: "center", justifyContent: "center" },
  myStatusLetter: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  statusAdd: { position: "absolute", right: -1, bottom: -1, width: 23, height: 23, borderRadius: 12, backgroundColor: "#087F50", borderWidth: 2, borderColor: "#F6FBF8", alignItems: "center", justifyContent: "center" },
  statusAddText: { color: "#FFFFFF", fontSize: 17, lineHeight: 20, fontWeight: "700" },
  statusPersonName: { color: "#27352D", fontSize: 11, marginTop: 7, textAlign: "center" },
  statusViewer: { flex: 1, backgroundColor: "#101814", justifyContent: "center", alignItems: "center", padding: 22 },
  statusViewerTop: { position: "absolute", top: 50, left: 16, right: 16, zIndex: 2, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusViewerText: { color: "#FFFFFF", fontSize: 17, fontWeight: "600", textAlign: "center", lineHeight: 26 },
  statusViewerClose: { color: "#FFFFFF", fontSize: 28, paddingHorizontal: 8 },
  statusViewerButton: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", backgroundColor: "#0B6B4B", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 20, overflow: "hidden" },
  authScreen: { justifyContent: "center", padding: 22 },
  authCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, borderWidth: 1, borderColor: "#E5EEE9", alignItems: "stretch" },
  authLogo: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#0B6B4B", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 14 },
  authLogoText: { color: "#FFFFFF", fontSize: 27, fontWeight: "800" },
  authHeading: { color: "#18251F", fontSize: 21, fontWeight: "800", marginTop: 28, marginBottom: 16 },
  authInput: { backgroundColor: "#F0F5F2", borderRadius: 13, paddingHorizontal: 15, paddingVertical: 14, color: "#18251F", fontSize: 14, marginBottom: 11 },
  authError: { color: "#B42318", fontSize: 12, lineHeight: 18, marginBottom: 10 },
  authNotice: { color: "#0B6B4B", fontSize: 12, lineHeight: 18, marginBottom: 10 },
  authButton: { backgroundColor: "#0B6B4B", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 5 },
  authButtonDisabled: { opacity: 0.6 },
  authButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  authSwitch: { color: "#0B6B4B", fontWeight: "700", fontSize: 13, textAlign: "center", marginTop: 18 },
  logoutButton: { alignSelf: "flex-start", paddingVertical: 12, marginTop: 8 },
  logoutText: { color: "#B42318", fontWeight: "700", fontSize: 13 },
  header: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: "#0B6B4B", fontSize: 27, fontWeight: "800" },
  subtitle: { color: "#718078", fontSize: 13, marginTop: 3 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#0B6B4B", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  content: { flex: 1, paddingHorizontal: 22, paddingTop: 8 },
  heading: { color: "#18251F", fontSize: 25, fontWeight: "800", marginBottom: 17 },
  search: { backgroundColor: "#EAF3EE", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: "#18251F", fontSize: 15, marginBottom: 12 },
  list: { paddingBottom: 18 },
  chatRow: { flexDirection: "row", alignItems: "center", paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#E5EEE9" },
  chatAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginRight: 12 },
  chatAvatarText: { color: "#0B6B4B", fontSize: 19, fontWeight: "800" },
  chatCopy: { flex: 1 },
  chatTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  chatName: { color: "#1B2922", fontSize: 15, fontWeight: "700", flex: 1 },
  time: { color: "#87958E", fontSize: 11 },
  message: { color: "#77857D", fontSize: 13, flex: 1, marginTop: 5 },
  unread: { backgroundColor: "#0B6B4B", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center" },
  unreadText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  empty: { color: "#77857D", fontSize: 14, lineHeight: 22, marginTop: 8 },
  chatHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5EEE9" },
  backButton: { width: 34, height: 42, justifyContent: "center" },
  backText: { color: "#0B6B4B", fontSize: 36, lineHeight: 40 },
  chatHeaderCopy: { flex: 1 },
  chatHeaderName: { color: "#1B2922", fontSize: 16, fontWeight: "700" },
  onlineText: { color: "#87958E", fontSize: 11, marginTop: 3 },
  messageList: { padding: 16, flexGrow: 1, justifyContent: "flex-end" },
  messageBubble: { maxWidth: "82%", paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16, marginBottom: 10 },
  myBubble: { alignSelf: "flex-end", backgroundColor: "#0B6B4B", borderBottomRightRadius: 4 },
  theirBubble: { alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#E5EEE9" },
  messageText: { color: "#1B2922", fontSize: 14, lineHeight: 20 },
  myMessageText: { color: "#FFFFFF" },
  messageTime: { color: "#87958E", fontSize: 10, alignSelf: "flex-end", marginTop: 5 },
  myMessageTime: { color: "#D4EAE0" },
  groupHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  groupComposer: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#E5EEE9" },
  groupSelectedRow: { backgroundColor: "#EAF3EE", borderRadius: 12, paddingHorizontal: 10 },
  inviteRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 7 },
  inviteAccept: { backgroundColor: "#0B6B4B", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  inviteAcceptText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  inviteDecline: { backgroundColor: "#FCE8E6", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  inviteDeclineText: { color: "#B42318", fontSize: 11, fontWeight: "700" },
  mediaActions: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 8, backgroundColor: "#FFFFFF" },
  mediaButton: { backgroundColor: "#EAF3EE", borderRadius: 14, paddingHorizontal: 13, paddingVertical: 8 },
  mediaButtonText: { color: "#0B6B4B", fontSize: 12, fontWeight: "700" },
  composer: { flexDirection: "row", alignItems: "flex-end", padding: 12, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E5EEE9", gap: 8 },
  composerInput: { flex: 1, maxHeight: 100, minHeight: 42, backgroundColor: "#F0F5F2", borderRadius: 18, paddingHorizontal: 15, paddingVertical: 10, color: "#18251F", fontSize: 14 },
  sendButton: { backgroundColor: "#0B6B4B", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, justifyContent: "center" },
  sendButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  settingCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 18, borderWidth: 1, borderColor: "#E5EEE9" },
  settingTitle: { color: "#1B2922", fontSize: 16, fontWeight: "700" },
  settingDescription: { color: "#77857D", fontSize: 13, lineHeight: 20, marginTop: 8 },
  toggle: { alignSelf: "flex-start", marginTop: 16, backgroundColor: "#E7EEE9", paddingHorizontal: 17, paddingVertical: 10, borderRadius: 20 },
  toggleOn: { backgroundColor: "#0B6B4B" },
  toggleText: { color: "#0B6B4B", fontWeight: "700" },
  toggleTextOn: { color: "#FFFFFF" },
  languageNote: { color: "#87958E", fontSize: 12, marginTop: 14 },
  languageOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  languageOption: { borderWidth: 1, borderColor: "#DCE7E0", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "#F6FBF8" },
  languageOptionSelected: { borderColor: "#0B6B4B", backgroundColor: "#E1F3E9" },
  languageOptionText: { color: "#526158", fontSize: 12, fontWeight: "600" },
  languageOptionTextSelected: { color: "#0B6B4B", fontWeight: "800" },
  bottomNav: { flexDirection: "row", justifyContent: "space-around", paddingTop: 14, paddingBottom: 18, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E5EEE9" },
  navItem: { paddingHorizontal: 8, paddingVertical: 4 },
  navText: { color: "#84928B", fontSize: 12, fontWeight: "600" },
  navTextActive: { color: "#0B6B4B", fontWeight: "800" },
});
