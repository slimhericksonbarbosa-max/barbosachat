import React, { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { isSupabaseConfigured, supabase } from "./src/lib/supabase";
import { createConversation, listContacts, listMyConversations, listMessages, sendMediaMessage, sendTextMessage, subscribeToMessages } from "./src/lib/chat";
import { createChatMediaUrl, deleteChatMedia, uploadChatMedia } from "./src/lib/media";
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
} from "react-native";

type ChatMessage = {
  id: string;
  text: string;
  time: string;
  mine: boolean;
  mediaPath?: string;
  mediaName?: string;
  mediaKind?: "image" | "video" | "audio" | "file";
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

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [tab, setTab] = useState<"Conversas" | "Contactos" | "Definições">("Conversas");
  const [search, setSearch] = useState("");
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [preferenceLoading, setPreferenceLoading] = useState(false);
  const [conversations, setConversations] = useState(INITIAL_CONVERSATIONS);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [contacts, setContacts] = useState<{ id: string; display_name: string; username: string | null }[]>([]);
  const [groupMode, setGroupMode] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [groupBusy, setGroupBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;
    let cancelled = false;
    const loadPreferences = async () => {
      setPreferenceLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("translation_mode, preferred_language")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!cancelled && !error && data) {
        setTranslationEnabled(data.translation_mode === "automatic");
      }
      if (!cancelled) setPreferenceLoading(false);
    };
    void loadPreferences();
    return () => { cancelled = true; };
  }, [session?.user.id]);

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
    });
    const loadHistory = async () => {
      setChatLoading(true);
      setChatError("");
      try {
        const rows = await listMessages(activeConversationId);
        if (cancelled) return;
        setConversations((current) => current.map((conversation) => conversation.id === activeConversationId
          ? (() => {
              const history = rows.map((row) => ({
                id: row.id,
                text: row.body,
                time: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                mine: row.sender_id === session.user.id,
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
  }, [activeConversationId, session?.user.id]);

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
          options: { data: { display_name: displayName.trim() } },
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

  const saveTranslationPreference = async (enabled: boolean) => {
    setTranslationEnabled(enabled);
    if (!session?.user.id) return;
    setPreferenceLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        translation_mode: enabled ? "automatic" : "manual",
        preferred_language: "pt",
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user.id);
    if (error) {
      setAuthError("Não foi possível guardar a preferência. Verifica a ligação.");
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
      const file = new File(uri);
      if (!file.exists) throw new Error("Não foi possível ler o ficheiro selecionado.");
      if (file.size > 50 * 1024 * 1024) throw new Error("O ficheiro excede o limite de 50 MB.");
      const bytes = await file.bytes();
      const uploaded = await uploadChatMedia({
        conversationId: activeConversationId,
        userId: session.user.id,
        fileData: bytes,
        fileName,
        contentType: contentType || file.type || "application/octet-stream",
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

  const openMedia = async (item: ChatMessage) => {
    if (!item.mediaPath) return;
    try {
      const url = await createChatMediaUrl(item.mediaPath);
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
      setConversations((current) => [{
        id: conversationId,
        name: contactName,
        message: "Ainda sem mensagens",
        time: "",
        color: "#D9F3E8",
        messages: [],
      }, ...current.filter((item) => item.id !== conversationId)]);
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
        message: "Grupo criado. Envia a primeira mensagem!",
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

  if (isSupabaseConfigured && !session) {
    return (
      <SafeAreaView style={[styles.safe, styles.authScreen]}>
        <StatusBar barStyle="dark-content" backgroundColor="#F6FBF8" />
        <View style={styles.authCard}>
          <View style={styles.authLogo}><Text style={styles.authLogoText}>B</Text></View>
          <Text style={styles.brand}>Barbosachat</Text>
          <Text style={styles.subtitle}>Perto de quem importa.</Text>
          <Text style={styles.authHeading}>{authMode === "login" ? "Bem-vindo de volta" : "Cria a tua conta"}</Text>
          {authMode === "signup" && (
            <TextInput value={displayName} onChangeText={setDisplayName} placeholder="O teu nome"
              placeholderTextColor="#82938B" style={styles.authInput} autoCapitalize="words" />
          )}
          <TextInput value={email} onChangeText={setEmail} placeholder="Email"
            placeholderTextColor="#82938B" style={styles.authInput} keyboardType="email-address"
            autoCapitalize="none" autoComplete="email" />
          <TextInput value={password} onChangeText={setPassword}
            placeholder="Palavra-passe (mínimo 8 caracteres)" placeholderTextColor="#82938B"
            style={styles.authInput} secureTextEntry autoCapitalize="none" />
          {!!authError && <Text style={styles.authError}>{authError}</Text>}
          {!!authNotice && <Text style={styles.authNotice}>{authNotice}</Text>}
          <Pressable onPress={handleAuth} disabled={authBusy}
            style={[styles.authButton, authBusy && styles.authButtonDisabled]}>
            <Text style={styles.authButtonText}>{authBusy ? "Aguarda..." : authMode === "login" ? "Entrar" : "Criar conta"}</Text>
          </Pressable>
          <Pressable onPress={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); setAuthNotice(""); }}>
            <Text style={styles.authSwitch}>{authMode === "login" ? "Ainda não tens conta? Criar conta" : "Já tens conta? Iniciar sessão"}</Text>
          </Pressable>
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
                      {"\n"}Toque para abrir
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.messageText, item.mine && styles.myMessageText]}>{item.text}</Text>
                )}
                <Text style={[styles.messageTime, item.mine && styles.myMessageTime]}>{item.time}</Text>
              </View>
            )}
          />

          {session && (
            <View style={styles.mediaActions}>
              <Pressable onPress={() => void pickPhotoOrVideo()} disabled={mediaBusy} style={styles.mediaButton}>
                <Text style={styles.mediaButtonText}>{mediaBusy ? "A enviar..." : "Foto/vídeo"}</Text>
              </Pressable>
              <Pressable onPress={() => void pickDocumentOrAudio()} disabled={mediaBusy} style={styles.mediaButton}>
                <Text style={styles.mediaButtonText}>Ficheiro/áudio</Text>
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
                <Text style={styles.settingDescription}>Cada utilizador poderá escolher individualmente se pretende tradução automática ou manual.</Text>
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
                <Text style={styles.languageNote}>Idioma: Português {session ? "· preferência guardada na tua conta" : "· demonstração local"}</Text>
                {preferenceLoading && <Text style={styles.languageNote}>A guardar preferência...</Text>}
                {session && (
                  <Pressable onPress={() => void supabase.auth.signOut()} style={styles.logoutButton}>
                    <Text style={styles.logoutText}>Terminar sessão</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          <View style={styles.bottomNav}>
            {(["Conversas", "Contactos", "Definições"] as const).map((item) => (
              <Pressable key={item} onPress={() => setTab(item)} style={styles.navItem}>
                <Text style={[styles.navText, tab === item && styles.navTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6FBF8" },
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
  bottomNav: { flexDirection: "row", justifyContent: "space-around", paddingTop: 14, paddingBottom: 18, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E5EEE9" },
  navItem: { paddingHorizontal: 8, paddingVertical: 4 },
  navText: { color: "#84928B", fontSize: 12, fontWeight: "600" },
  navTextActive: { color: "#0B6B4B", fontWeight: "800" },
});
