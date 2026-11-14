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
- Idioma inicial: Português; cada utilizador pode escolher o seu idioma preferido.
- Envio de fotografias, vídeos, áudios e documentos para armazenamento privado da conversa (até 50 MB por ficheiro).
- Recuperação de palavra-passe por email com ligação profunda para a aplicação.
- Registo opcional de notificações push por dispositivo.

## Estado técnico — 14 de novembro de 2026

- Projeto Supabase configurado e oito migrações aplicadas.
- Row Level Security ativo nas tabelas da aplicação e armazenamento multimédia privado.
- Associação EAS configurada no `app.json`.
- Segredo `EXPO_TOKEN` do GitHub Actions validado por uma execução real do workflow.
- Verificações automáticas concluídas com sucesso: TypeScript, Expo Doctor e exportação dos bundles iOS e Android.
- **Build Android preview concluída com sucesso em 14 de novembro de 2026.**

[Ver e instalar a build Android preview](https://expo.dev/accounts/slimhericksonbarbosa/projects/barbosachat-/builds/83acafee-ad48-4838-b89a-4ea759776428)

A build acima é uma versão de teste para instalação direta em Android; não é ainda uma publicação na Google Play. A instalação e os fluxos principais ainda precisam de ser testados num dispositivo real.

## Próximas etapas

1. Instalar a build Android preview num dispositivo Android e testar registo, início de sessão, conversas individuais e de grupo.
2. Testar envio e abertura de fotografias, vídeos, áudios e documentos com duas contas reais.
3. Preparar uma build iOS para iPhone. A distribuição interna em iPhone exige credenciais de assinatura Apple e registo do identificador do dispositivo (UDID); a distribuição ad hoc requer adesão paga ao Apple Developer Program.
4. Configurar credenciais FCM V1 para Android e APNs para iOS e testar notificações push em dispositivos físicos.
5. Adicionar os redirecionamentos `barbosachat://auth/callback` e `barbosachat://reset-password` à lista permitida do Supabase Auth.
6. Fazer uma revisão das dependências e resolver os alertas de segurança antes de qualquer lançamento público.
7. Avaliar chamadas de voz/vídeo, bloqueios, denúncias e políticas de privacidade.

As funcionalidades de rede e comunicação real devem ser testadas antes de qualquer lançamento público.

## Criar novas builds Android

No GitHub, abre **Actions → Barbosachat Android build → Run workflow** e escolhe o perfil:

- `preview`: versão de teste para instalar diretamente em dispositivos Android.
- `development`: versão com ferramentas de desenvolvimento.
- `production`: versão destinada ao processo de publicação na loja.

O workflow atual cria builds Android. A build iOS terá de ser preparada depois da configuração das credenciais Apple e do registo dos dispositivos de teste.

## Executar localmente

```bash
npm install
npx expo start
```

O projeto já inclui a URL e a chave pública (publishable) do Supabase Barbosachat como configuração predefinida. Opcionalmente, podes substituir estes valores através de `.env`, usando o modelo em `.env.example`.

## Configuração do Supabase

Segue o guia passo a passo em [supabase/SETUP.md](supabase/SETUP.md). O ficheiro [.env.example](.env.example) contém apenas valores públicos de cliente. Nunca publiques segredos ou a chave `service_role`.
