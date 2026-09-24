# Agenda Itália

Aplicação web responsiva para gestão da agenda de um profissional de psicologia. O projeto foi criado do zero com foco em uma rotina simples, confirmação de consultas e proteção de dados.

## Recursos do MVP

- Cadastro inicial e login protegido para o psicólogo
- Agenda semanal com navegação por dia
- Cadastro, edição, busca, arquivamento e restauração de pacientes
- Criação e edição de consultas, com atendimento presencial ou por vídeo
- Prevenção de conflitos de horário
- Status da consulta: agendada, confirmada, concluída, cancelada ou não compareceu
- Confirmação por e-mail via SMTP
- Lembretes automáticos no intervalo definido pelo profissional
- Mensagem pronta e atalho para WhatsApp
- E-mail e WhatsApp condicionados ao contato e à autorização do paciente
- Configuração de perfil, duração padrão, antecedência dos lembretes e fuso horário
- Banco SQLite local, sem dados sensíveis versionados no Git
- Interface responsiva para computador, tablet e celular

## Tecnologias

- React 19 + TypeScript + Vite
- Express 5
- SQLite com `better-sqlite3`
- TanStack Query
- Nodemailer
- Zod, Helmet, `jose` e `bcryptjs`
- Vitest + Supertest

## Como executar

Requisitos: Node.js 22.12 ou superior e npm.

```bash
npm install
cp .env.example .env
npm run dev
```

No Windows PowerShell, a cópia pode ser feita com:

```powershell
Copy-Item .env.example .env
```

A aplicação ficará disponível em `http://localhost:3000`.

No primeiro acesso, a agenda apresenta uma tela de configuração. Crie a conta profissional; não existe senha padrão no projeto.

## E-mail e confirmações

O MVP funciona mesmo sem SMTP. Para enviar confirmações e lembretes automáticos, preencha estas variáveis em `.env`:

```env
SMTP_HOST=smtp.seuprovedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario-do-smtp
SMTP_PASS=senha-do-smtp
SMTP_FROM="Agenda Italia <agenda@seudominio.com>
```

Reinicie o servidor após alterar o `.env`. O paciente precisa ter e-mail cadastrado e autorização habilitada.

O WhatsApp não recebe mensagens automaticamente nesta versão. Por segurança e para evitar custos ou compartilhamento de dados com terceiros, a interface gera a mensagem e abre a conversa do paciente para revisão e envio manual.

## Segurança e privacidade

- Senhas são armazenadas somente com hash `bcrypt`.
- A sessão usa cookie `HttpOnly`, `SameSite=Strict` e assinatura JWT.
- Mutações verificam a origem da requisição.
- Consultas que conflitam são bloqueadas no servidor.
- Interfaces sensíveis não registram dados de pacientes nos logs.
- O diretório `data/` está no `.gitignore`.
- Configure `SESSION_SECRET` com ao menos 32 caracteres em produção.

Gere um segredo seguro com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Backups

O arquivo principal fica em `data/agenda.sqlite`. Para backup, pare a aplicação e copie a pasta `data/` para um local protegido. Para restauração, pare a aplicação e restaure a cópia. Não versione nem envie o banco por serviços públicos.

## Comandos

```bash
npm run dev        # servidor com recarga
npm run build      # valida TypeScript e gera o frontend
npm start          # executa a versão de produção
npm run typecheck  # valida os tipos
npm run lint       # valida estilo e boas práticas
npm test           # executa os testes automatizados
```

## Executar com PM2 neste computador

O arquivo `ecosystem.config.cjs` mantém a aplicação em modo produção com reinício automático:

```powershell
npm.cmd install -g pm2
pm2.cmd start ecosystem.config.cjs --only agenda-italia
pm2.cmd save
pm2.cmd status
```

Comandos úteis:

```powershell
pm2.cmd logs agenda-italia
pm2.cmd restart agenda-italia
pm2.cmd stop agenda-italia
pm2.cmd delete agenda-italia
```

O `pm2 save` preserva a lista de processos, mas não configura a inicialização automática do Windows. Para isso, execute `pm2 startup` em um terminal administrativo e siga o comando exibido.

## Testes

Os testes cobrem:

- configuração inicial da conta;
- autenticação e proteção das rotas;
- cadastro de paciente;
- criação de consulta;
- bloqueio de horários conflitantes;
- execução única do lembrete automático.

## Estrutura principal

```text
server/
  routes/          APIs de autenticação, agenda, pacientes e configurações
  app.ts           configuração do Express e middlewares
  database.ts      schema e migrações SQLite
  email.ts         mensagens e transporte SMTP
  reminders.ts     processamento de lembretes
src/
  components/      componentes e diálogos
  context/         estado de autenticação
  lib/             API, datas e WhatsApp
  pages/           telas da aplicação
tests/             testes de integração
```

## Próximas evoluções recomendadas

1. Recuperação de senha por e-mail erotação de sessões.
2. Exportação e restauração criptografada de backup pela interface.
3. Agenda pública com link de reserva e aprovação pelo profissional.
4. Integração oficial com WhatsApp Business, após avaliação de consentimento e LGPD.
5. Relatórios de frequência e assiduidade.
6. Sincronização opcional com Google Calendar, mantendo o SQLite como fonte local.

> Esta versão é um MVP local para um profissional. Antes de expor a aplicação à internet, inclua HTTPS, backups automatizados, política de recuperação e uma revisão de segurança e LGPD.
