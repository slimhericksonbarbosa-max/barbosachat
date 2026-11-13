# Barbosachat

Aplicação de mensagens para Android e iPhone, construída com Expo e React Native.

## Funcionalidades atuais

- Interface inicial em português, com identidade visual verde.
- Separadores de Conversas, Contactos e Definições.
- Pesquisa local de conversas.
- Ecrã individual de conversa com histórico local de demonstração ou histórico persistente via Supabase.
- Envio de mensagens persistentes e sincronização em tempo real quando o Supabase está configurado.
- Criação de conversas individuais e grupos com seleção de participantes.
- Indicador de mensagens não lidas e atualização da última mensagem.
- Preferência individual de tradução automática ou modo manual, guardada no perfil Supabase quando configurado.
- Envio de fotografias, vídeos, áudios e documentos para armazenamento privado da conversa (até 50 MB por ficheiro).
- Recuperação de palavra-passe por email com ligação profunda para a aplicação.
- Registo opcional de notificações push por dispositivo.
- Idioma inicial: Português.

## Executar localmente

```bash
npm install
npx expo start
```

O projeto já inclui a URL e a chave pública (publishable) do Supabase Barbosachat como configuração predefinida. Opcionalmente, podes substituir estes valores através de `.env`, usando o modelo em `.env.example`.

## Estado técnico

A aplicação inclui registo/início de sessão, perfis, descoberta de contactos, criação de conversas, envio e histórico de mensagens persistentes e subscrição Realtime. O backend Supabase tem um bucket privado `chat-media` com políticas de acesso limitadas aos membros de cada conversa e uploads limitados a 50 MB. A interface de envio de fotografias, vídeos, áudios e documentos está integrada; faltam testes reais em dispositivos e validação ponta a ponta. A associação EAS já está configurada no `app.json`; a primeira development build e as credenciais nativas de notificações ainda estão pendentes.

## Próximas etapas

1. Configurar o segredo `EXPO_TOKEN` no GitHub e executar a development build pelo workflow **Barbosachat EAS build**.
2. Configurar as credenciais APNs/FCM no EAS e testar notificações push em dispositivos físicos.
3. Adicionar os redirecionamentos `barbosachat://auth/callback` e `barbosachat://reset-password` à lista permitida do Supabase Auth.
4. Testar registo, início de sessão e recuperação de palavra-passe com duas contas reais.
5. Testar o envio e a abertura de fotografias, vídeos, áudio e documentos com duas contas reais.
6. Avaliar chamadas de voz/vídeo.
7. Implementar bloqueios, denúncias e políticas de privacidade.

As funcionalidades de rede e comunicação real devem ser testadas antes de qualquer lançamento público.

## Configuração do Supabase

Segue o guia passo a passo em [supabase/SETUP.md](supabase/SETUP.md). O ficheiro [.env.example](.env.example) contém apenas valores públicos de cliente. Nunca publiques chaves privadas ou a chave `service_role`.
