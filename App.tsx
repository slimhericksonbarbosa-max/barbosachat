import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  StatusBar,
} from "react-native";

type Conversation = {
  id: string;
  name: string;
  message: string;
  time: string;
  unread?: number;
  color: string;
};

const INITIAL_CONVERSATIONS: Conversation[] = [
  { id: "1", name: "Bem-vindo ao Barbosachat", message: "O teu espaço para conversar começa aqui.", time: "Agora", unread: 1, color: "#D9F3E8" },
  { id: "2", name: "Equipa Barbosachat", message: "Estamos a preparar novidades!", time: "Ontem", color: "#E8E8FF" },
];

export default function App() {
  const [tab, setTab] = useState<"Conversas" | "Contactos" | "Definições">("Conversas");
  const [search, setSearch] = useState("");
  const [translationEnabled, setTranslationEnabled] = useState(false);

  const conversations = useMemo(
    () => INITIAL_CONVERSATIONS.filter((item) =>
      (item.name + " " + item.message).toLowerCase().includes(search.toLowerCase())
    ),
    [search]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6FBF8" />
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
            data={conversations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>Não encontrámos conversas.</Text>}
            renderItem={({ item }) => (
              <Pressable style={styles.chatRow}>
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
          <Text style={styles.empty}>Os teus contactos aparecerão aqui quando a função de contactos estiver ligada.</Text>
        </View>
      )}

      {tab === "Definições" && (
        <View style={styles.content}>
          <Text style={styles.heading}>Definições</Text>
          <View style={styles.settingCard}>
            <Text style={styles.settingTitle}>Tradução automática</Text>
            <Text style={styles.settingDescription}>A tradução está desligada por defeito. Cada utilizador poderá escolher como prefere traduzir as mensagens.</Text>
            <Pressable
              onPress={() => setTranslationEnabled((value) => !value)}
              style={[styles.toggle, translationEnabled && styles.toggleOn]}
              accessibilityRole="switch"
              accessibilityState={{ checked: translationEnabled }}
            >
              <Text style={styles.toggleText}>{translationEnabled ? "Ativada" : "Desativada"}</Text>
            </Pressable>
            <Text style={styles.languageNote}>Idioma de demonstração: Português</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6FBF8" },
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
  chatAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginRight: 13 },
  chatAvatarText: { color: "#0B6B4B", fontSize: 20, fontWeight: "800" },
  chatCopy: { flex: 1 },
  chatTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  chatName: { color: "#1B2922", fontSize: 15, fontWeight: "700", flex: 1 },
  time: { color: "#87958E", fontSize: 11 },
  message: { color: "#77857D", fontSize: 13, flex: 1, marginTop: 5 },
  unread: { backgroundColor: "#0B6B4B", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center" },
  unreadText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  empty: { color: "#77857D", fontSize: 14, lineHeight: 22, marginTop: 8 },
  settingCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 18, borderWidth: 1, borderColor: "#E5EEE9" },
  settingTitle: { color: "#1B2922", fontSize: 16, fontWeight: "700" },
  settingDescription: { color: "#77857D", fontSize: 13, lineHeight: 20, marginTop: 8 },
  toggle: { alignSelf: "flex-start", marginTop: 16, backgroundColor: "#E7EEE9", paddingHorizontal: 17, paddingVertical: 10, borderRadius: 20 },
  toggleOn: { backgroundColor: "#0B6B4B" },
  toggleText: { color: "#0B6B4B", fontWeight: "700" },
  languageNote: { color: "#87958E", fontSize: 12, marginTop: 14 },
  bottomNav: { flexDirection: "row", justifyContent: "space-around", paddingTop: 14, paddingBottom: 18, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E5EEE9" },
  navItem: { paddingHorizontal: 8, paddingVertical: 4 },
  navText: { color: "#84928B", fontSize: 12, fontWeight: "600" },
  navTextActive: { color: "#0B6B4B", fontWeight: "800" },
});
