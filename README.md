# Barbosachat

Aplicação de mensagens para Android e iPhone, construída com Expo e React Native.

## Funcionalidades atuais

- Interface inicial em português, com identidade visual verde.
- Separadores de Conversas, Contactos e Definições.
- Pesquisa local de conversas.
- Ecrã individual de conversa com histórico demonstrativo.
- Envio de mensagens locais na demonstração.
- Indicador de mensagens não lidas e atualização da última mensagem.
- Preferência demonstrativa de tradução automática ou modo manual.
- Idioma de demonstração: Português.

## Executar localmente

```bash
npm install
npx expo start
```

## Estado técnico

A interface inclui agora o fluxo de registo/início de sessão e a preparação do cliente Supabase. A autenticação e as preferências individuais só ficam operacionais depois de criares o projeto Supabase, executares `supabase/schema.sql` e configurares as variáveis locais. O envio de mensagens continua demonstrativo e local: ainda não foi ligado à base de dados nem à sincronização em tempo real. Não existem ainda notificações push.

## Próximas etapas

1. Definir autenticação, perfis e recuperação de conta.
2. Ligar uma base de dados e mensagens em tempo real.
3. Persistir as preferências individuais de idioma e tradução.
4. Implementar envio de fotografias, vídeos e áudio.
5. Adicionar notificações e chamadas de voz/vídeo.
6. Implementar privacidade, segurança, bloqueios e denúncias.

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
