# 📘 DOCS — Plataforma Web (`web/`)

> Guia técnico oficial do app web da Plataforma Lotofácil.
> Público-alvo: desenvolvedores novos e de manutenção.
> Última atualização: 01/08/2026

---

## 1. Visão Geral

O `web/` é o **app web publicado no Vercel** — uma plataforma de loterias com
geração de jogos por **IA (algoritmo genético)**, carteira digital, bolões,
assinaturas recorrentes, gamificação e estatísticas avançadas.

- **Stack:** Node.js + Express 4 + EJS + PostgreSQL (Neon) + express-session
- **Deploy:** Vercel (serverless) — `Root Directory: web`
- **Banco:** Neon (Postgres serverless com SSL), gerenciado
- **Frontend:** EJS renderizado no servidor + `public/js/api.js` (fetch/JSON)

> ⚠️ O projeto é um **monorepo**: há outros componentes (app mobile React Native,
> auth-service em TypeScript, engine Python, páginas HTML legadas) — mas **este
> documento cobre apenas o `web/`**, que é o que roda em produção no Vercel.

---

## 2. Estrutura de Arquivos

```
web/
├── server.js               # Composição: config + sessão + mount dos routers + erro
├── db.js                   # Camada de persistência PostgreSQL (pool + queries)
├── lib/                    # Módulos compartilhados (extraídos do server.js)
│   ├── context.js          # Estado central: cache de resultados, semente, engine
│   │                       #   IA, bootstrap, APIs externas (Caixa/Guidi/free-apiloterias)
│   ├── auth.js             # Helpers de autenticação (requireAuth, requireAdmin, sanitizeUser)
│   ├── lottery.js          # LOTTERY_CONFIGS + PRIZE_TABLES
│   ├── gamification.js     # Conquistas + nível (ACHIEVEMENTS, getUserLevel, checkAchievements)
│   ├── subscriptions.js    # processSubscriptions (auto-renovação)
│   ├── notifications.js    # addNotification
│   ├── http.js             # asyncHandler + asyncRouter (monkey-patch de rotas async)
│   ├── validation.js       # Schemas Zod + middleware validate()
│   └── genetic_engine.js   # Motor genético (IA) — semente, evolução, geração
├── routes/                 # Routers por domínio (extraídos do server.js)
│   ├── auth.js             # /login, /register + /api/auth/*
│   ├── pages.js            # Páginas (dashboard, apostas, carteira, ...)
│   ├── admin.js            # /evolucao + /api/ai/evolution-history, /api/ai/evolve
│   ├── ai.js               # /api/simulate, /api/ai/generate, /api/ai/seed
│   ├── dashboard.js        # /api/dashboard, lucky-numbers, portfolio-insights
│   ├── bets.js             # /api/bets
│   ├── games.js            # /api/games (portfólio)
│   ├── wallet.js           # /api/wallet
│   ├── pools.js            # /api/pools + mercado de cotas
│   ├── results.js          # /api/results + /api/database/stats
│   ├── notifications.js    # /api/notifications
│   ├── subscriptions.js    # /api/subscriptions + cron
│   ├── gamification.js     # /api/gamification
│   ├── share.js            # /api/share
│   ├── stats.js            # /api/stats/advanced
│   └── profile.js          # /api/profile
├── views/                  # Telas em EJS (renderizadas no servidor)
├── public/
│   ├── css/style.css       # Estilos
│   └── js/
│       ├── app.js          # Helper de API (fetch) — cliente HTTP
│       └── api.js          # Funções por domínio (getGames, login, etc.)
├── database/               # Migrações e seed
├── tests/                  # Suíte de testes (Vitest + Supertest) — ver §6
├── vitest.config.js
├── eslint.config.js        # ESLint flat config (CommonJS + testes ESM)
├── .prettierrc.json        # Config do Prettier
├── package.json
├── vercel.json
├── README-VERCEL.md        # Guia de deploy Vercel + Neon
└── DOCS.md                 # Este documento
```

### 2.1 Nota sobre a refatoração (routers)
O antigo `server.js` monolítico (~1939 linhas com 69 rotas) foi dividido em:
- **`lib/`** — estado e lógica compartilhada (o coração: cache, engine, auth, validação);
- **`routes/`** — um router Express por domínio, montados no `server.js`.

**Regra de ouro ao mover rotas:** rotas com parâmetro `:id` DEVEM vir por último no
router (ex.: `GET /api/games/:id` depois de `/api/games/export-csv`,
`/api/games/performance-report`, `/api/games/share-stats` — senão o Express
interceptaria as rotas específicas). Sempre rode `npm test` após mover rotas.

---

## 3. Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel (serverless)                   │
│                                                         │
│  Browser ── HTTP ──► Express app (server.js)            │
│                        │                                │
│                        ├─► EJS views (render no servidor)│
│                        │                                │
│                        ├─► public/js (fetch → JSON)     │
│                        │                                │
│                        └─► db.js (pg pool)              │
│                              │                          │
└──────────────────────────────┼──────────────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │  Neon (Postgres SSL) │
                    │  users, games,       │
                    │  transactions, bets, │
                    │  pools, results,     │
                    │  session, ...        │
                    └──────────────────────┘
```

### 3.1 Pontos-chave da arquitetura

1. **Monolito dividido em routers** — o `server.js` virou composição; as rotas
   vivem em `routes/*.js` e o estado/lógica compartilhada em `lib/*.js`.
2. **Sessões persistentes no Postgres** — `connect-pg-simple`; cookie de sessão
   com `maxAge` de 30 dias (quem já logou entra direto no dashboard).
3. **Cache progressivo de resultados** — o cache em memória começa com os 100
   concursos mais recentes (boot rápido) e hidrata em background até o histórico
   completo; no Vercel o histórico completo é carregado de forma síncrona (~711ms).
4. **IA com semente persistida** — o `genetic_engine.js` salva a semente no
   Postgres (`seed` table) via `seedSaver`; a fitness é treinada contra os últimos
   `FITNESS_WINDOW_SIZE` concursos (default 300).
5. **Async handler monkey-patch** — Express 4 não captura rejeições de handlers
   async; o `asyncRouter` (lib/http.js) envolve os handlers de cada router,
   encaminhando erros ao middleware de erro (evita unhandled rejections).
6. **Validação com Zod** — payloads das rotas-chave validados por schemas
   centralizados em `lib/validation.js` (mensagens em pt-BR, 400 automático).

### 3.2 Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | Connection string do Neon (pooled, com SSL) |
| `SESSION_SECRET` | ✅ (prod) | Segredo de assinatura da sessão |
| `CRON_SECRET` | para cron | Protege `/api/cron/*` |
| `SITE_URL` | opcional | URL pública (compartilhamento social) |
| `SESSION_MAX_AGE_DAYS` | opcional | Validade da sessão (default `30`) |
| `FITNESS_WINDOW_SIZE` | opcional | Janela de concursos da IA (default `300`) |
| `PGSSL=false` | local | Postgres local sem SSL |
| `COOKIE_SECURE` | local | `false` em dev HTTP; no Vercel ativa por padrão |

> `server.js`/`db.js` carregam `.env` e `.env.local` (com `override: true` —
> o `.env.local` tem prioridade, é o formato gerado por `vercel env pull`).

---

## 4. Modelo de Dados (Postgres)

| Tabela | Colunas relevantes | Notas |
|---|---|---|
| `users` | `id` (UUID), `name`, `email`, `password` (hash bcrypt), `balance`, `bonusBalance`, `totalWinnings`, `role` | IDs são **UUID** desde a migração (07/2026) |
| `games` | `id`, `user_id`, `numbers` (JSON), `gameType`, `name`, `source`, `seedVersion`, `status`, `usageHistory` (JSON), `pool_id` | Portfólio de jogos |
| `transactions` | `id`, `user_id`, `type` (deposit/withdrawal/bet/prize/pool_join), `amount`, `status`, `description` | Extrato da carteira |
| `bets` | `id`, `user_id`, `gameType`, `numbers`, `amount`, `status` | Apostas |
| `pools` | `id`, `name`, `gameType`, `contestNumber`, `totalShares`, `availableShares`, `sharePrice`, `numbers`, `creator_name`, `status`, `participants` (JSON) | Bolões; participantes referenciam por **nome**, não por id |
| `results` | `numero` (PK), `listaDezenas` (JSON), `dataApuracao` | Concursos da Lotofácil (3750+) |
| `notifications` | `id`, `user_id`, `type`, `title`, `message`, `read` | Notificações |
| `subscriptions` | `id`, `user_id`, `gameType`, `numbers`, `active` | Assinaturas recorrentes |
| `user_achievements` | `user_id`, `achievement_id` | Conquistas desbloqueadas |
| `seed` | `game_type`, `data` | Semente da IA persistida |
| `session` | `sid` | Sessões (connect-pg-simple) |
| `market_offers` | — | Ofertas de cotas de bolão |

---

## 5. Referência da API

Todas as rotas de API retornam **JSON**. Rotas protegidas exigem sessão
(`requireAuth`) e respondem `401` com `{ error: "Não autenticado" }` sem sessão.
Rotas de admin exigem `role === 'admin'` (`403` caso contrário).

### 5.1 Autenticação

| Método | Rota | Descrição |
|---|---|---|
| GET | `/login` | Página de login (redireciona pro `/` se já logado) |
| GET | `/register` | Página de cadastro |
| POST | `/api/auth/register` | Cria conta `{name, email, password}` — senha ≥ 6 chars; dá bônus de R$50 |
| POST | `/api/auth/login` | Login `{email, password}` → cria sessão |
| POST | `/api/auth/logout` | Encerra sessão e limpa cookie |
| GET | `/api/auth/me` | `{authenticated, user}` — dados do usuário logado |

### 5.2 Páginas (render EJS)

`/` (dashboard), `/apostas`, `/carteira`, `/boloes`, `/simulacao`, `/resultados`,
`/perfil`, `/meus-jogos`, `/configuracoes`, `/estatisticas` — todas exigem login.
`/evolucao` exige admin.

### 5.3 Dashboard

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dashboard` | Resumo: usuário, último resultado, transações, bolões ativos, apostas |
| GET | `/api/dashboard/lucky-numbers` | Números da sorte do dia (frequência dos últimos 50 + IA) |
| GET | `/api/dashboard/portfolio-insights` | Cobertura do portfólio, melhores jogos, números faltantes |

### 5.4 Jogos (Portfólio)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/games` | Cria jogo `{numbers, gameType, name, source}` — valida quantidade, range 1–25 e duplicados |
| GET | `/api/games` | Lista jogos (filtros `?status=&source=&gameType=`) |
| GET | `/api/games/stats` | Contadores por status + total de acertos |
| GET | `/api/games/:id` | Busca um jogo |
| PUT | `/api/games/:id` | Atualiza `{name, status}` |
| DELETE | `/api/games/:id` | Exclui (sem uso) ou arquiva (com uso) |
| POST | `/api/games/:id/use` | Marca como usado num concurso |
| POST | `/api/games/:id/check-result` | Confere contra o último sorteio; premia (≥11 acertos) e notifica |
| POST | `/api/games/:id/create-pool` | Cria bolão a partir do jogo |
| POST | `/api/games/:id/duplicate` | Duplica o jogo (nome "(cópia)") |
| POST | `/api/games/compare` | Compara 2+ jogos (similaridade Jaccard, cobertura combinada) |
| GET | `/api/games/export-csv` | Exporta portfólio em CSV (BOM para Excel) |
| GET | `/api/games/performance-report` | Relatório de desempenho do portfólio |
| GET | `/api/games/share-stats` | Compartilhamento social |

### 5.5 Apostas

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/bets` | Cria aposta `{gameType, numbers, amount}` — debita da carteira |
| GET | `/api/bets` | Lista apostas do usuário |
| GET | `/api/bets/my` | Alias de listagem |

### 5.6 Carteira

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/wallet` | Saldo, bônus, total ganho + transações |
| POST | `/api/wallet/deposit` | Depósito `{amount, method}` |
| POST | `/api/wallet/withdraw` | Saque `{amount}` — status `pending`, valida saldo |

### 5.7 Bolões

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/pools` | Lista bolões |
| POST | `/api/pools` | Cria bolão (1 cota reservada ao criador, debita carteira) |
| POST | `/api/pools/:id/join` | Entra com `{shares}` — valida cotas e saldo |
| POST | `/api/pools/:id/create-offer` | Vende cotas (mercado de cotas) |
| POST | `/api/pools/:id/buy-offer/:offerId` | Compra oferta de cotas |
| GET | `/api/pools/popular` | Bolões populares (dashboard) |

### 5.8 IA / Simulação

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/simulate` | Simula `{numbers}` contra 50 sorteios simulados + jogo IA |
| GET | `/api/ai/generate` | Gera `?quantity=` jogos com o motor genético |
| GET | `/api/ai/seed` | Retorna a semente atual da IA |
| GET | `/api/ai/evolution-history` | (admin) Histórico de evolução |
| POST | `/api/ai/evolve` | (admin) Evolui `{generations}` (1–100) |
| GET | `/api/ai/evolve/status` | (admin) `{evolving}` |

### 5.9 Resultados

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/results/latest` | Último resultado (cache local prioritário, APIs em background) |
| GET | `/api/results/history/recent?limit=` | Histórico recente |
| GET | `/api/results/:contest` | Concurso específico (cache → Postgres → APIs) |
| GET | `/api/database/stats` | `{total, first, last, lastDate}` de concursos |

### 5.10 Notificações / Gamificação / Outros

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/notifications` | Lista + contagem de não lidas |
| POST | `/api/notifications/read-all` | Marca todas como lidas |
| POST | `/api/notifications/:id/read` | Marca uma como lida |
| GET | `/api/gamification/level` | Nível/XP do usuário |
| GET | `/api/gamification/achievements` | Conquistas do usuário |
| POST | `/api/share/game` / `/api/share/pool` | Links de compartilhamento |
| GET | `/api/stats/advanced` | Estatísticas avançadas (heatmap, quentes/frios, atraso) |
| PUT | `/api/profile` | Atualiza perfil |
| GET | `/api/cron/process-subscriptions` | Cron de auto-renovação (protegido por `CRON_SECRET`) |

### 5.11 Assinaturas

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/subscriptions` | Cria assinatura recorrente |
| GET | `/api/subscriptions` | Lista assinaturas |
| DELETE | `/api/subscriptions/:id` | Cancela assinatura |

---

## 6. Testes (Vitest + Supertest)

A suíte roda contra o **banco real** (DATABASE_URL do `.env.local`/`.env`) —
para não poluir dados de produção, cada teste cria usuários **únicos** com
timestamp e os apaga no `afterAll`. Use o ambiente de produção apenas se for
seguro, ou defina `TEST_DATABASE_URL` no `.env.local` (o `db.js` dá prioridade
a ela quando presente — isola os testes do banco de produção).

### 6.1 Como rodar

> ⚠️ **Regra para quem vai manter este código:** SEMPRE defina `TEST_DATABASE_URL`
> no `.env.local` apontando para um banco **dedicado a testes** (pode ser um
> segundo banco no mesmo projeto Neon). Sem ela, a suíte roda contra o banco
> configurado em `DATABASE_URL` — os testes criam e apagam usuários reais lá
> (mesmo com cleanup, poluem `session`/transações/sequências).

```bash
cd web
npm test          # roda a suíte uma vez (42 testes, ~20-25s)
npm run test:watch  # modo watch (desenvolvimento)
npm run check     # checagem de sintaxe (node --check) de server.js e db.js
npm run lint      # ESLint (flat config)
npm run format    # Prettier (formata lib/ routes/ tests/ server.js)
```

Exemplo de `.env.local` com banco de teste isolado:

```bash
# Banco de produção (o app usa este)
DATABASE_URL="postgresql://neondb_owner:...@ep-...pooler.neon.tech/neondb?sslmode=require"
# Banco dedicado para os testes (o db.js dá prioridade a ele quando presente)
TEST_DATABASE_URL="postgresql://neondb_owner:...@ep-...pooler.neon.tech/neondb_test?sslmode=require"
```

### 6.2 Cobertura atual (42 testes, 6 arquivos)

| Arquivo | Testes | Cobre |
|---|---|---|
| `tests/auth.test.js` | 8 | registro, validações (senha curta, email duplicado), login, logout, `/me`, 401 |
| `tests/games.test.js` | 9 | CRUD, validações (qtd, range, duplicados), stats, duplicar, usar, check-result, delete |
| `tests/wallet.test.js` | 6 | saldo inicial, depósito, saque, validações, histórico |
| `tests/pools.test.js` | 5 | criar, listar, join, cotas insuficientes, saldo insuficiente |
| `tests/results.test.js` | 6 | último resultado, histórico, por concurso, stats, 401 |
| `tests/ai.test.js` | 8 | geração IA, simulação, seed, lucky-numbers, 401, admin 403 |

### 6.3 Como funciona (não quebre isso!)

- **`tests/setup.js`** define `VERCEL=1`, `NODE_ENV=test`, `COOKIE_SECURE=false`
  **ANTES** do import do `server.js` — isso faz o módulo **exportar só o `app`**
  do Express sem abrir porta (`app.listen` só roda quando `VERCEL !== '1'`).
  Também registra `afterAll` global fechando o pool do Postgres.
- **`tests/helpers.js`** exporta:
  - `registerUser()` — cria usuário único e retorna `agent` supertest autenticado;
  - `cleanupTestData()` — apaga usuários de teste + dados dependentes;
  - `api` — cliente supertest **sem sessão** (testes de 401 / rotas públicas).
- **Sempre** use `registerUser()` + `cleanupTestData()` em `afterAll`.
  **Nunca** crie usuários com emails fixos (poluiriam o banco).
- **Vitest config:** `fileParallelism: false`, `maxWorkers: 1`, `singleFork: true`
  (roda sequencial; cada arquivo reimporta o `server.js` e o bootstrap).
- O **bootstrap em modo teste** carrega só os 100 resultados recentes + a semente
  da IA (pula o histórico completo de 3750 concursos com timeout de 8s) — isso
  mantém a suíte rápida e estável. Se você adicionar testes de `/api/ai/*`, a
  semente já estará carregada.

### 6.4 Como adicionar um teste novo

```js
// tests/meu-dominio.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerUser, cleanupTestData, api } from './helpers.js';

describe('Meu Domínio', () => {
  let agent;
  beforeAll(async () => { ({ agent } = await registerUser()); });
  afterAll(async () => { await cleanupTestData(); });

  it('rota pública funciona', async () => {
    const res = await api.get('/api/...');
    expect(res.status).toBe(200);
  });
});
```

---

## 7. Convenções de Código (leia antes de codar!)

1. **Um padrão de frontend só:** fetch/JSON via `api.js` + renderização com
   `innerHTML` nas views EJS. **Não** introduzir htmx ou outro paradigma
   (decisão deliberada — ver §9.4). JS dentro das views deve ser **extraído
   para `public/js/`** quando crescer demais.
2. **Rotas por domínio:** novas rotas vão em `routes/<dominio>.js`; estado e
   lógica compartilhada vão em `lib/` (context, auth, validation, ...). Não
   voltar a colocar rotas no `server.js` (ele é só composição).
3. **Payloads com Zod:** valide `req.body` com `validate(schema)` de
   `lib/validation.js` (mensagens em pt-BR, 400 automático). Validações de
   negócio (saldo, cotas, permissão) continuam nos handlers.
4. **IDs são UUID** (`crypto.randomUUID()` / pacote `uuid`). Não use IDs
   sequenciais (`'1'`, `'2'`) em nenhum lugar — isso inclui seeds e testes.
5. **Senhas:** sempre `bcrypt.hash(password, 10)`; nunca logar/retornar hash
   ou senha (`sanitizeUser` já remove `password`).
6. **Rotas protegidas:** use `requireAuth`; admin use `requireAdmin` depois.
7. **Async:** rotas com `async` usam o wrapper automático (`asyncRouter`);
   não precisa de try/catch em tudo, mas **não engula erros** em `catch(e) {}`
   silencioso.
8. **Banco:** novas queries vão no `db.js` (pool `pg`); nunca abra conexão direta
   fora de lá (exceto scripts de teste/cleanup com `db.pool`).
9. **Lint e formatação:** rode `npm run lint` e `npm run format` antes de
   commitar (ESLint flat + Prettier, configs na raiz do `web/`).
10. **Comentários em português** no estilo dos existentes (explicam o "porquê").
11. **Não commitar:** `.env`, `.env.local`, credenciais, seeds com senhas em
    texto puro, scripts temporários (`_*.js`), backups.

---

## 8. Segurança (medidas aplicadas)

- **Sem credenciais no código/repo** — as senhas das contas demo foram
  rotacionadas e são repassadas apenas ao responsável do projeto.
- **IDs UUID** — migração completa (07/2026): `users`, `games`, `transactions`,
  `bets`, `notifications`, `subscriptions`, `user_achievements`, `pools` e
  `games.pool_id` usam UUID. Impossível enumerar recursos por ID sequencial.
- **Sessão persistente com segredo assinado** — `SESSION_SECRET` do ambiente;
  cookie `Secure` no Vercel (HTTPS), `httpOnly`, `maxAge` 30 dias.
- **Senhas com bcrypt** (custo 10) — nunca armazenadas em texto puro.
- **Acesso admin por role** — `requireAdmin` valida `role === 'admin'`.
- **Cron protegido** — `/api/cron/*` exige `CRON_SECRET`.
- **Sem exposição de hash** — `sanitizeUser` remove `password` de toda resposta.
- **Tela de login limpa** — placeholders orientativos, sem dados pré-preenchidos.

---

## 9. Decisões de Arquitetura (ADRs)

### 9.1 Por que Postgres (Neon) em vez de JSON?
O app era persistido em JSON/memória; migrou para Postgres gerenciado (Neon)
para funcionar no modelo serverless do Vercel (sem estado local persistente) e
compartilhar dados entre instâncias. Ver `README-VERCEL.md` para o deploy.

### 9.2 Por que UUID?
Segurança (não enumerar recursos) + prontidão para escala. A migração foi
completa (seed + produção), executada em transação com cascata. **Não reverta
para IDs sequenciais.**

### 9.3 Por que NÃO voltar ao `server.js` monolítico? (refatorado em 08/2026)
O projeto começou pequeno e o `server.js` concentrava tudo (~1939 linhas, 69
rotas + estado + bootstrap). Em 08/2026 foi **refatorado em routers** (`lib/` +
`routes/`) com a suíte de testes (42) como rede de segurança. Manter esse
formato: rotas novas vão em `routes/`, estado compartilhado em `lib/`.

### 9.4 Por que NÃO usar htmx? (avaliado em 08/2026)
Avaliamos htmx ("mistura de JS e HTML") e **decidimos não adotar agora**:
1. **Dois paradigmas = mais confusão** — hoje o padrão é fetch/JSON + innerHTML.
   Introduzir htmx criaria dois jeitos de fazer a mesma coisa.
2. **htmx exige HTML fragments no servidor** — as 56+ rotas retornam JSON;
   migrar acoplaria a API ao HTML e perderia consumo por outros clientes.
3. **As telas pesadas não se beneficiam** (simulação IA, heatmap, evolução
   genética precisam de JS real).
4. **O que realmente atrapalha a manutenção** é JS inline nas views, HTML por
   concatenação de strings, e falta de testes/linter — não a ausência de htmx.

**Caminho recomendado (o "espírito htmx" sem o custo):** extrair JS inline das
views para `public/js/` e usar partials EJS para cards repetidos.

### 9.5 Por que cache progressivo?
Cold starts no serverless não podem carregar 3750 concursos de uma vez com
latência aceitável. O cache progressivo (100 → hidratação em lotes → histórico
completo) equilibra primeira tela rápida e aprendizado da IA com tudo.

### 9.6 Por que refatorar em routers? (08/2026)
O `server.js` monolítico (~1939 linhas, 69 rotas) era difícil de navegar para
novos devs e concentrava estado + rotas. A refatoração dividiu em `lib/`
(estado/lógica compartilhada) + `routes/` (um router por domínio), mantendo
**o mesmo comportamento** (validado pela suíte de 42 testes).

### 9.7 Por que Zod + ESLint + Prettier? (08/2026)
- **Zod**: validação de entrada centralizada e consistente (antes era manual,
  espalhada e inconsistente); mensagens em pt-BR e 400 automático.
- **ESLint** (flat config) + **Prettier**: rede de segurança de qualidade para
  um projeto que será mantido por outras pessoas. `npm run lint` / `npm run format`.
- OBS.: essas ferramentas **não existiam** até 08/2026 — foram adicionadas nesta
  rodada (não é necessário código legado 100% limpo; warnings são aceitos).

---

## 10. Workflow de Desenvolvimento

### 10.1 Setup local

```bash
# 1) Banco
#    Opção A (Neon): pegue a connection string pooled e ponha no .env.local
#    Opção B (Docker local):
docker run -d --name lotofacil-pg \
  -e POSTGRES_PASSWORD=senha -e POSTGRES_DB=lotofacil -p 5432:5432 postgres:15-alpine

# 2) Instalar e configurar
cd web
npm install
cp .env.example .env.local   # preencha DATABASE_URL, SESSION_SECRET
# Em dev local HTTP, adicione: COOKIE_SECURE=false

# 3) Migrar dados (importa JSONs locais para o Postgres)
npm run migrate

# 4) Rodar
npm run dev                  # http://localhost:3000 (hot-reload)

# 5) Testar
npm test
```

> ⚠️ `database/lotofacil.json` (resultados) **não é versionado** — os resultados
> já estão no Neon (3750+ concursos). O `npm run migrate` importa os JSONs
> presentes localmente; se não tiver, o banco do Neon já está populado.

### 10.2 Deploy (Vercel)

Resumo — detalhes completos em `web/README-VERCEL.md`:
1. Crie o projeto no Vercel com **Root Directory: `web`**.
2. Configure as env vars: `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`,
   `SITE_URL` (e opcionais).
3. O `vercel.json` cuida do Express serverless + cron de resultados.
4. Deploy! A **URL de produção** (`https://<projeto>.vercel.app`) é a correta
   para usuários. Links de preview `*-git-main-*.vercel.app` pedem login da
   Vercel (proteção da plataforma) — não é login do app.

### 10.3 Fluxo de mudança (checklist do dev)

1. Rode `npm run check` + `npm test` antes de começar (base verde).
2. Faça a mudança (siga §7 Convenções).
3. Adicione testes para o que mudou (§6.4).
4. Rode `npm test` — tudo verde.
5. Revise se não vazou credencial/segredo (§8).
6. Commit com mensagem clara; documente no `CHECKPOINT.md` se for correção relevante.

---

## 11. Erros Comuns

| Erro | Causa | Solução |
|---|---|---|
| "DATABASE_URL não definida" | `.env.local` vazio | Preencha com a connection string do Neon |
| Login não persiste em dev | cookie `Secure` em HTTP | Adicione `COOKIE_SECURE=false` no `.env.local` |
| Testes falham todos com 401 | `.env.local` com `COOKIE_SECURE=true` | `NODE_ENV=test` já desativa Secure; remova `COOKIE_SECURE=true` se presente |
| Suíte lenta/instável | bootstrap carregando histórico completo | Em `NODE_ENV=test` o bootstrap já pula o histórico completo — não remova esse guard |
| 401 em preview do Vercel | você está no link `*-git-main-*` | Use a URL de produção |
| "table X does not exist" | banco não migrado | `npm run migrate` ou verifique schema do Neon |
| ID `'1'`/`'2'` sumiu | migração UUID | IDs agora são UUID; procure o UUID no seed/db |
