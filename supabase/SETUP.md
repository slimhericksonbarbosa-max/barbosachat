# Configuração do backend do Barbosachat

O projeto Supabase Barbosachat já está criado e a estrutura inicial da base de dados já foi aplicada. A aplicação contém os dados públicos de ligação predefinidos; não precisas de copiar chaves para o código.

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
- Migrações aplicadas e versionadas em `supabase/migrations/`

## Executar a aplicação

Na raiz do repositório:

```bash
npm install
npx expo start
```

A configuração predefinida já aponta para o projeto Barbosachat. Se precisares de substituir os valores para outro ambiente, cria um ficheiro local `.env` com base em `.env.example`. Não publiques segredos nem a chave `service_role`.

## Testes necessários

Antes do lançamento, testar com duas contas reais e dois dispositivos:

1. Criar uma conta com um endereço de email controlado.
2. Confirmar o email, caso a confirmação esteja ativa no Supabase Auth.
3. Terminar sessão e voltar a entrar.
4. Confirmar que o perfil é criado.
5. Alterar o modo de tradução e confirmar que a preferência individual fica guardada.
6. Criar uma conversa entre as duas contas e enviar mensagens nos dois sentidos.
7. Confirmar que cada conta só consegue consultar conversas de que é membro.
8. Confirmar que apenas membros da conversa conseguem enviar e consultar os respetivos ficheiros.

## Funcionalidades ainda por concluir

O backend já tem o bucket privado para ficheiros de conversa, mas a interface de envio/visualização na aplicação ainda não está implementada. Também faltam recuperação de conta, notificações push, chamadas de voz/vídeo, bloqueios e denúncias. Estes módulos precisam de implementação e testes próprios antes de um lançamento público.

Nunca partilhes palavras-passe, tokens privados ou a chave `service_role` no chat ou no repositório.
