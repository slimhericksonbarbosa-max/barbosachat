# Barbosachat

Aplicação de mensagens para Android e iPhone, construída com Expo e React Native.

## Funcionalidades atuais

- Interface inicial em português, com identidade visual verde.
- Separadores de Conversas, Contactos e Definições.
- Pesquisa local de conversas.
- Ecrã individual de conversa com histórico local de demonstração ou histórico persistente via Supabase.
- Envio de mensagens persistentes e sincronização em tempo real quando o Supabase está configurado.
- Indicador de mensagens não lidas e atualização da última mensagem.
- Preferência individual de tradução automática ou modo manual, guardada no perfil Supabase quando configurado.
- Idioma inicial: Português.

## Executar localmente

```bash
npm install
npx expo start
```

## Estado técnico

A aplicação inclui registo/início de sessão, perfis, descoberta de contactos, criação de conversas, envio e histórico de mensagens persistentes e subscrição Realtime. Estas funcionalidades dependem de um projeto Supabase configurado, do schema aplicado e das variáveis locais definidas. A integração está preparada no código, mas ainda precisa de testes de ponta a ponta com duas contas reais. Não existem ainda notificações push.

## Próximas etapas

1. Configurar e testar o projeto Supabase com duas contas reais.
2. Implementar recuperação de conta e reforçar os testes de segurança/RLS.
3. Implementar envio de fotografias, vídeos, áudio e ficheiros com armazenamento seguro.
4. Adicionar notificações push.
5. Avaliar chamadas de voz/vídeo.
6. Implementar bloqueios, denúncias e políticas de privacidade.

As funcionalidades de rede e comunicação real devem ser implementadas e testadas antes de qualquer lançamento público.


## Configuração do Supabase

Segue o guia passo a passo em [supabase/SETUP.md](supabase/SETUP.md). O ficheiro [.env.example](.env.example) mostra as variáveis públicas necessárias. Cria um ficheiro local `.env` com os teus valores reais e nunca publiques chaves privadas ou a chave `service_role`.

Resumo:
1. Criar um projeto Supabase.
2. Executar `supabase/schema.sql` no SQL Editor.
3. Ativar Realtime para a tabela `messages`.
4. Configurar `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` no ficheiro local `.env`.
5. Executar `npm install` e `npx expo start`.

A configuração do Supabase ainda depende da criação do projeto pelo proprietário. Até essa configuração ser concluída e testada, autenticação persistente, preferências guardadas e mensagens reais não devem ser consideradas operacionais.
