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
- Idioma inicial: Português.

## Executar localmente

```bash
npm install
npx expo start
```

O projeto já inclui a URL e a chave pública (publishable) do Supabase Barbosachat como configuração predefinida. Opcionalmente, podes substituir estes valores através de `.env`, usando o modelo em `.env.example`.

## Estado técnico

A aplicação inclui registo/início de sessão, perfis, descoberta de contactos, criação de conversas, envio e histórico de mensagens persistentes e subscrição Realtime. O backend Supabase também tem um bucket privado `chat-media` com políticas de acesso limitadas aos membros de cada conversa e uploads limitados a 50 MB. A interface de envio de fotografias, vídeos, áudios e documentos já está integrada; faltam testes reais em dispositivos e validação ponta a ponta. Ainda são necessários testes de ponta a ponta com duas contas reais, configuração/validação de email e testes em dispositivos. Não existem ainda notificações push.

## Próximas etapas

1. Testar registo, início de sessão e mensagens com duas contas reais.
2. Implementar recuperação de conta e rever fluxos de email.
3. Testar o envio e a abertura de fotografias, vídeos, áudio e documentos com duas contas reais.
4. Adicionar notificações push.
5. Avaliar chamadas de voz/vídeo.
6. Implementar bloqueios, denúncias e políticas de privacidade.

As funcionalidades de rede e comunicação real devem ser testadas antes de qualquer lançamento público.

## Configuração do Supabase

Segue o guia passo a passo em [supabase/SETUP.md](supabase/SETUP.md). O ficheiro [.env.example](.env.example) contém apenas valores públicos de cliente. Nunca publiques chaves privadas ou a chave `service_role`.
