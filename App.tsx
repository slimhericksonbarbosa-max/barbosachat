import React, { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./src/lib/supabase";
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
} from "react-native";

type ChatMessage = {
  id: string;
  text: string;
  time: string;
  mine: boolean;
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

  const activeConversation = conversations.find((item) => item.id === activeConversationId);

  const filteredConversations = useMemo(
    () => conversations.filter((item) =>
      (item.name + " " + item.message).toLowerCase().includes(search.toLowerCase())
    ),
    [conversations, search]
  );

  const sendMessage = () => {
    const text = draft.trim();
    if (!text || !activeConversationId) return;

    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const message: ChatMessage = {
      id: String(Date.now()),
      text,
      time,
      mine: true,
    };

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversationId
          ? { ...conversation, messages: [...conversation.messages, message], message: text, time: "Agora", unread: 0 }
          : conversation
      )
    );
    setDraft("");
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
              <Text style={styles.onlineText}>Conversa demonstrativa</Text>
            </View>
          </View>

          <FlatList
            data={activeConversation.messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            ListEmptyComponent={<Text style={styles.empty}>Ainda não existem mensagens. Envia a primeira!</Text>}
            renderItem={({ item }) => (
              <View style={[styles.messageBubble, item.mine ? styles.myBubble : styles.theirBubble]}>
                <Text style={[styles.messageText, item.mine && styles.myMessageText]}>{item.text}</Text>
                <Text style={[styles.messageTime, item.mine && styles.myMessageTime]}>{item.time}</Text>
              </View>
            )}
          />

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
              <Text style={styles.heading}>Contactos</Text>
              <Text style={styles.empty}>A lista de contactos será ligada quando implementarmos contas e permissões de acesso.</Text>
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
