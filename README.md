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
