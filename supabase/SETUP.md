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

## Funcionalidades ainda por concluir

O backend inicial ainda não configura recuperação de conta, armazenamento de fotografias/vídeos/áudio/ficheiros, notificações push, chamadas de voz/vídeo, bloqueios ou denúncias. Estes módulos precisam de implementação e testes próprios antes de um lançamento público.

Nunca partilhes palavras-passe, tokens privados ou a chave `service_role` no chat ou no repositório.
