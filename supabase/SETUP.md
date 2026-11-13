# Configuração do backend do Barbosachat

O projeto Supabase Barbosachat já está criado e a estrutura de dados, as regras de segurança e o armazenamento privado já foram aplicados. A aplicação contém os dados públicos de ligação predefinidos; não precisas de copiar chaves para o código.

## Estado do backend

- Projeto Supabase: `Barbosachat`
- Região: `eu-central-1`
- Tabelas: `profiles`, `conversations`, `conversation_members`, `messages`, `push_tokens`
- Row Level Security: ativado nas cinco tabelas da aplicação
- Realtime: `messages` e `conversation_members` incluídas na publicação
- Funções privilegiadas auxiliares: guardadas no schema privado
- Acesso `anon` às tabelas da aplicação: revogado
- Armazenamento: bucket privado `chat-media`, limite de 50 MB por ficheiro
- Políticas de Storage: upload por membros autenticados, leitura por membros da conversa e eliminação pelo proprietário do ficheiro
- Migrações aplicadas e versionadas em `supabase/migrations/` (oito no total)
- Privilégios por defeito reforçados para objetos criados pelo papel `postgres` no schema `public`
- Interface de envio: fotografia/vídeo pela galeria e áudio/documentos pelo seletor de ficheiros
- Mensagens multimédia guardam metadados e o caminho privado no histórico
- Notificações push: tabela privada de tokens e Edge Function `send-chat-notification` ativa com validação JWT

## Executar a aplicação

Na raiz do repositório:

```bash
npm install
npx expo start
```

A configuração predefinida já aponta para o projeto Barbosachat. Se precisares de substituir os valores para outro ambiente, cria um ficheiro local `.env` com base em `.env.example`. Não publiques segredos nem a chave `service_role`.

As dependências de seleção de ficheiros e acesso ao sistema de ficheiros estão alinhadas com o Expo SDK 54.

## Recuperação de conta

A aplicação já inclui confirmação de email e recuperação de palavra-passe com retorno à aplicação. No painel Supabase, em **Authentication → URL Configuration → Redirect URLs**, adiciona exatamente estas duas entradas à lista de redirecionamentos permitidos:

- `barbosachat://auth/callback`
- `barbosachat://reset-password`

Sem estas autorizações, o Supabase pode rejeitar o envio do email ou redirecioná-lo incorretamente.

## Notificações push e builds EAS

O backend já tem a tabela privada `push_tokens` e a Edge Function `send-chat-notification` ativa. A aplicação permite ao utilizador ativar notificações nas Definições e regista o token Expo do dispositivo. A função só envia notificações depois de validar a sessão, a autoria da mensagem e os membros da conversa.

A associação do projeto EAS já está configurada no `app.json`. Para permitir que o GitHub Actions inicie builds:

1. Na tua conta Expo, cria um access token em **Account Settings → Access Tokens**.
2. No GitHub, abre o repositório **Settings → Secrets and variables → Actions → New repository secret**.
3. Cria um segredo com o nome exato `EXPO_TOKEN` e cola nele o token Expo. Não coloques o token no código, em ficheiros do repositório ou nesta conversa.
4. Abre **Actions → Barbosachat EAS build → Run workflow**.
5. Escolhe a plataforma e o perfil `development` para criar a primeira development build. O workflow também permite `preview` e `production`.

Para builds iniciadas localmente, usa `npx eas-cli@latest login` e depois `npx eas-cli@latest build --profile development --platform all`. Não é necessário executar `eas init` novamente, pois a associação já está gravada.

Configura as credenciais de notificações para Android (FCM V1) e iOS (APNs) no EAS quando forem solicitadas. Depois instala a development build em dispositivos físicos, inicia sessão e ativa as notificações em Definições. O Expo Go não suporta notificações push remotas em Android a partir do SDK 53.

## Testes necessários

Antes do lançamento, testar com duas contas reais e dois dispositivos:

1. Criar uma conta com um endereço de email controlado.
2. Confirmar o email, caso a confirmação esteja ativa no Supabase Auth, e confirmar que a ligação abre o Barbosachat.
3. Pedir a recuperação da palavra-passe, abrir o email num telemóvel com a aplicação instalada e guardar uma nova palavra-passe.
4. Terminar sessão e voltar a entrar.
5. Confirmar que o perfil é criado.
6. Alterar o modo de tradução e confirmar que a preferência individual fica guardada.
7. Criar uma conversa entre as duas contas e enviar mensagens nos dois sentidos.
8. Criar um grupo, escolher pelo menos duas pessoas e confirmar que todos os participantes conseguem conversar.
9. Confirmar que cada conta só consegue consultar conversas de que é membro.
10. Confirmar que apenas membros da conversa conseguem enviar e consultar os respetivos ficheiros.
11. Enviar uma fotografia, um vídeo, um áudio e um documento, e abrir cada item no segundo dispositivo.
12. Ativar notificações num dispositivo e confirmar que uma mensagem enviada por outra conta gera um aviso.
13. Ao criar novas tabelas, ativar RLS e conceder apenas os privilégios necessários.

## Funcionalidades ainda por concluir

A interface de envio e abertura de fotografias, vídeos, áudios e documentos está implementada, mas ainda precisa de testes reais em dispositivos. A recuperação de conta está implementada, mas os redirecionamentos Supabase ainda precisam de ser autorizados. As notificações push estão preparadas no código e no backend, mas exigem o segredo `EXPO_TOKEN`, uma development build e credenciais APNs/FCM. Ainda faltam chamadas de voz/vídeo, bloqueios e denúncias. Estes módulos precisam de implementação e testes próprios antes de um lançamento público.

Nunca partilhes palavras-passe, tokens privados ou a chave `service_role` no chat ou no repositório.
