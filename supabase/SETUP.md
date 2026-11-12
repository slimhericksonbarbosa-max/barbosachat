# Configuração do backend do Barbosachat

O projeto Supabase Barbosachat já está criado e a estrutura de dados, as regras de segurança e o armazenamento privado já foram aplicados. A aplicação contém os dados públicos de ligação predefinidos; não precisas de copiar chaves para o código.

## Estado do backend

- Projeto Supabase: `Barbosachat`
- Região: `eu-central-1`
- Tabelas: `profiles`, `conversations`, `conversation_members`, `messages`
- Row Level Security: ativado nas quatro tabelas
- Realtime: `messages` e `conversation_members` incluídas na publicação
- Funções privilegiadas auxiliares: guardadas no schema privado
- Acesso `anon` às tabelas da aplicação: revogado
- Armazenamento: bucket privado `chat-media`, limite de 50 MB por ficheiro
- Políticas de Storage: upload por membros autenticados, leitura por membros da conversa e eliminação pelo proprietário do ficheiro
- Migrações aplicadas e versionadas em `supabase/migrations/` (sete no total)
- Privilégios por defeito reforçados para objetos criados pelo papel `postgres` no schema `public`
- Interface de envio: fotografia/vídeo pela galeria e áudio/documentos pelo seletor de ficheiros
- Mensagens multimédia guardam metadados e o caminho privado no histórico

## Executar a aplicação

Na raiz do repositório:

```bash
npm install
npx expo start
```

A configuração predefinida já aponta para o projeto Barbosachat. Se precisares de substituir os valores para outro ambiente, cria um ficheiro local `.env` com base em `.env.example`. Não publiques segredos nem a chave `service_role`.

As dependências de seleção de ficheiros e acesso ao sistema de ficheiros estão alinhadas com o Expo SDK 54.

## Testes necessários

Antes do lançamento, testar com duas contas reais e dois dispositivos:

1. Criar uma conta com um endereço de email controlado.
2. Confirmar o email, caso a confirmação esteja ativa no Supabase Auth.
3. Terminar sessão e voltar a entrar.
4. Confirmar que o perfil é criado.
5. Alterar o modo de tradução e confirmar que a preferência individual fica guardada.
6. Criar uma conversa entre as duas contas e enviar mensagens nos dois sentidos.
7. Criar um grupo, escolher pelo menos duas pessoas e confirmar que todos os participantes conseguem conversar.
8. Confirmar que cada conta só consegue consultar conversas de que é membro.
9. Confirmar que apenas membros da conversa conseguem enviar e consultar os respetivos ficheiros.
10. Enviar uma fotografia, um vídeo, um áudio e um documento, e abrir cada item no segundo dispositivo.
11. Ao criar novas tabelas, ativar RLS e conceder apenas os privilégios necessários.

## Funcionalidades ainda por concluir

A interface de envio e abertura de fotografias, vídeos, áudios e documentos está implementada, mas ainda precisa de testes reais em dispositivos. Também faltam recuperação de conta, notificações push, chamadas de voz/vídeo, bloqueios e denúncias. Estes módulos precisam de implementação e testes próprios antes de um lançamento público.

Nunca partilhes palavras-passe, tokens privados ou a chave `service_role` no chat ou no repositório.
