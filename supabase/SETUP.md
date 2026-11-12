# Configuração do backend do Barbosachat

Este guia prepara o Supabase para autenticação, perfis, contactos e conversas com mensagens persistentes.

## 1. Criar o projeto

1. Abre https://supabase.com/dashboard e cria um projeto.
2. Guarda a palavra-passe da base de dados num gestor de palavras-passe.
3. Em **Project Settings → API**, copia a **Project URL** e a chave pública **anon/publishable**.
4. Nunca coloques a chave `service_role` na aplicação móvel nem num ficheiro versionado.

## 2. Criar as tabelas e políticas

1. No painel do Supabase, abre **SQL Editor**.
2. Abre o ficheiro `supabase/schema.sql` deste repositório.
3. Copia todo o conteúdo para uma nova consulta SQL e executa.
4. Confirma que as tabelas `profiles`, `conversations`, `conversation_members` e `messages`, e a função `create_conversation`, foram criadas.
5. Em **Database → Publications** (ou na configuração de Realtime), ativa a tabela `messages` para Realtime.

Executa o script apenas num projeto novo ou depois de rever cuidadosamente o impacto das alterações. Não o executes cegamente sobre uma base de dados com dados reais.

## 3. Configurar a aplicação

Na raiz do projeto, cria um ficheiro local chamado `.env` com:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://TEU-PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=A_TUA_CHAVE_PUBLICA_ANON
```

Substitui os valores pelos dados do teu projeto. O ficheiro `.env` não deve ser enviado para o GitHub. O modelo sem segredos está em `.env.example`.

## 4. Executar e testar

```bash
npm install
npx expo start
```

Testa primeiro:
- criar uma conta com um email que controles;
- confirmar o email, se a confirmação estiver ativa;
- iniciar e terminar sessão;
- verificar se o perfil é criado;
- alterar a preferência de tradução e confirmar que fica guardada após voltar a entrar;
- criar duas contas, iniciar uma conversa entre elas e confirmar que as mensagens aparecem em ambos os dispositivos.

## Estado e limitações

A aplicação contém integração para autenticação, perfis, contactos, conversas, mensagens persistentes e Realtime. A integração ainda precisa de ser validada com um projeto Supabase real e duas contas. Este guia não configura armazenamento de ficheiros, notificações push ou chamadas.

Antes de um lançamento público, rever e testar as políticas RLS, os fluxos de recuperação de conta, a validação de dados, os limites contra abuso e as regras de privacidade. Nunca partilhes credenciais privadas no chat ou no repositório.
