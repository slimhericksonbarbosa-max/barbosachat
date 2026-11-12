# Configurar o backend do Barbosachat

## O que já está preparado
- Esquema inicial para perfis, conversas, participantes e mensagens.
- Políticas Row Level Security (RLS) para limitar conversas e mensagens aos participantes.
- Criação automática de perfil quando uma conta é registada.
- Cliente Supabase com armazenamento seguro da sessão no dispositivo.
- Variáveis de ambiente de exemplo.

## Passos necessários no Supabase
1. Cria um projeto em https://supabase.com/dashboard (o plano gratuito é suficiente para começar; consulta os limites atuais).
2. Abre SQL Editor e executa todo o conteúdo de `supabase/schema.sql`.
3. Em Project Settings > API, copia Project URL e a chave pública anon/publishable.
4. Cria um ficheiro local `.env` a partir de `.env.example` e preenche:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
5. Reinicia Expo depois de alterar as variáveis: `npx expo start -c`.
6. Em Database > Replication/Realtime, ativa Realtime para a tabela `messages`.

## Segurança
- Não uses a chave `service_role` no telemóvel nem a publiques no GitHub.
- Mantém RLS ativado em todas as tabelas.
- Antes de lançar, acrescentar verificação de email, recuperação de palavra-passe, limites anti-spam e revisão das políticas.
- O cliente só deve usar a chave pública anon/publishable; a proteção depende das políticas RLS.

## Estado
A ligação ainda não está operacional até criares o projeto e configurares as variáveis. A interface demonstrativa continua separada do backend nesta etapa.
