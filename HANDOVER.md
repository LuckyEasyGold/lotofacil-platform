# 📋 HANDOVER — Plataforma Lotofácil (repasse para novo desenvolvedor)

> **Data do repasse:** 31/07/2026
> **Objetivo deste documento:** explicar o que já foi feito, o estado atual do código,
> o que **ainda falta fazer** e como dar manutenção/deploy no serviço.
> Leia este arquivo **antes** de tocar em qualquer coisa.

---

## 1. Visão geral do projeto

Plataforma de jogos da **Lotofácil** com: criação de jogos, bolões (pools) com mercado de cotas,
carteira virtual (depósito/saque), **IA genética** que sugere números, assinaturas recorrentes,
conquistas/gamificação, histórico de resultados e dashboard.

O projeto é um **monorepo** com 3 partes independentes:

| Pasta | O que é | Stack | Status no deploy |
|---|---|---|---|
| **`web/`** | Plataforma web principal (site completo) | Node.js + Express + EJS | ✅ **Migrada para Vercel + Neon** |
| **`api_jogos_ia/`** | Motor de IA em Python (algoritmo genético DEAP) | Python + FastAPI + SQLAlchemy + Postgres + Redis | ⚠️ **Não migrada** (ficou de fora) |
| **`lotofacil-platform/`** | App mobile + serviços de backend | React Native + auth-service (Prisma) + gateway | ⚠️ **Não migrada** (ficou de fora) |

> **Resumo:** a migração feita foi **somente na pasta `web/`**. As outras duas partes
> continuam do jeito que estavam (pensadas para rodar via Docker/servidor contínuo).

---

## 2. O que foi feito (migração `web/` → Vercel + Neon)

### Motivo

O Vercel é **serverless**: cada requisição pode cair numa instância diferente, o filesystem é
**somente leitura** e não há processo contínuo rodando. O `web/server.js` antigo dependia de
exatamente o que o Vercel não oferece:

- **Persistência em arquivos JSON** (`database/*.json`) → lançava `EROFS: read-only file system`.
- **Sessões em memória** (`MemoryStore` do `express-session`) → usuário deslogado aleatoriamente.
- **Dados em RAM** (transactions, bets, pools, notifications) → perdidos a cada cold start.
- **Job em background** `setInterval(processSubscriptions, 60s)` → não roda em serverless.
- **`app.listen` direto** → o Vercel espera exportar o app (Express serverless).

### Solução aplicada

Toda a persistência foi movida para **PostgreSQL gerenciado (Neon)**, escolhido por:
- Postgres serverless com **connection pooling nativo** (essencial no Vercel).
- O projeto já falava "PostgreSQL" (Prisma no auth-service e SQLAlchemy na API Python).
- Free tier generoso.

---

## 3. Arquivos criados / modificados

Todos os caminhos relativos a **`web/`** (a raiz do deploy no Vercel):

| Arquivo | Status | Descrição |
|---|---|---|
| **`web/db.js`** | 🆕 **Criado** | Camada de persistência Postgres. Pool do Neon com SSL, `ensureSchema()` (10 tabelas + `session`), ~40 funções parametrizadas (anti SQL injection). Substitui todos os `loadUsers/saveUsers` etc. |
| **`web/server.js`** | ✏️ **Reescrito** | Todo JSON/memória → chamadas ao `db.js`. Sessões com `connect-pg-simple`. `setInterval` removido → endpoint de cron. `module.exports = app` no final + `app.listen` só se `VERCEL !== '1'`. |
| **`web/lib/genetic_engine.js`** | ✏️ **Modificado** | Motor genético agora carrega histórico e semente do **banco** via providers injetáveis (`historicalResultsProvider`, `seedProvider`, `seedSaver`), com fallback para os JSONs locais. `autoEvolve: false` no serverless (economiza CPU). |
| **`web/database/migrate.js`** | 🆕 **Criado** | Script **idempotente** que migra os dados dos JSONs locais para o Postgres (users, games, subscriptions, achievements, results, seed da IA e bolões iniciais). |
| **`web/vercel.json`** | 🆕 **Criado** | Config do Vercel: build com `@vercel/node`, rota catch-all `/(.*) → /server.js`, `includeFiles` para `views/`, `public/`, `lib/`, e **cron diário** (`0 12 * * *`). |
| **`web/package.json`** | ✏️ **Modificado** | Novas dependências: `pg`, `connect-pg-simple`, `dotenv`. Novos scripts: `migrate`, `vercel-build`, `dev` (`node --watch`). |
| **`web/.env.example`** | 🆕 **Criado** | Template das variáveis de ambiente (ver seção 7). |
| **`web/.gitignore`** | 🆕 **Criado** | Ignora `node_modules/`, `.env`, `.vercel/`, `database/*.json` (agora os JSONs são apenas fonte de migração). |
| **`web/README-VERCEL.md`** | 🆕 **Criado** | Guia de deploy detalhado (banco Neon, env vars, passos no Vercel). |
| **`web/database/seed.js`** | 🔒 **Não tocado** | Ainda existe e serve para popular resultados localmente. |

### Detalhes importantes do `server.js` reescrito

- **Wrapper async (`asyncHandler`)**: monkey-patch em `app.get/post/put/delete` que captura
  rejeições de handlers async e encaminha ao middleware de erro (Evita *unhandled rejection*
  que derrubaria o processo no Node 15+).
- **Ordem de rotas corrigida**: `GET /api/games/:id` e `GET /api/results/:contest` foram movidas
  para **depois** das rotas específicas (`/api/games/export-csv`, `/api/games/performance-report`,
  `/api/games/share-stats`, `/api/games/compare`, `/api/results/history/recent`). Sem isso o
  Express capturava as rotas específicas como se fossem `:id`.
- **Cron endpoint**: `GET /api/cron/process-subscriptions` protegido por `CRON_SECRET`
  (header `Authorization: Bearer <secret>` ou `x-vercel-cron`).
- **Sessão**: `connect-pg-simple` com tabela `session` no Postgres (criada automaticamente),
  cookie `secure` automático quando `VERCEL === '1'` ou `COOKIE_SECURE=true`.

---

## 4. Modelo de dados (tabelas no Postgres)

Criadas por `db.ensureSchema()` (chamado no bootstrap, idempotente):

`users`, `games`, `pools`, `transactions`, `bets`, `notifications`, `subscriptions`,
`user_achievements`, `results` (cache de concursos), `seeds` (evolução da IA) e `session`
(gerenciada pelo `connect-pg-simple`).

> Os dados que **antes** eram arquivos JSON agora são tabelas. Os que **antes** eram só
> arrays em memória (transactions, bets, notifications) agora também persistem.

---

## 5. ✅ O que está pronto (validado)

- ✅ Sintaxe de todos os arquivos alterados (`node --check`) — **OK**
- ✅ `server.js` exporta o app corretamente como função serverless (`VERCEL=1` sem `app.listen`)
- ✅ Ordenação das rotas verificada por método HTTP
- ✅ 3 rodadas de code review aprovadas
- ✅ `npm install` executado com sucesso (deps: `pg`, `connect-pg-simple`, `dotenv`)

---

## 6. ⚠️ O que AINDA precisa ser feito (pendências do repasse)

> ⚠️ **IMPORTANTE:** o código está pronto, mas **nada foi testado contra um banco real**
> e **nenhum deploy foi feito**. A validação até agora foi apenas local/sintática.

### Bloqueantes (para colocar no ar)

1. **Criar o banco no Neon** — acessar [console.neon.tech](https://console.neon.tech), criar
   projeto e copiar a **Pooled connection string** (hostname termina em `-pooler.neon.tech`).
2. **⚠️ Preservar os dados JSON ANTES de migrar**: o `.gitignore` ignora `database/*.json`
   (users, games, lotofacil, seeds, subscriptions, achievements). Se estes arquivos **não
   estiverem commitados**, um clone novo do repo **não terá a fonte de dados** para a
   migração (o `migrate.js` pularia tudo silenciosamente e só criaria os 2 bolões iniciais).
   → Antes de qualquer coisa, **faça backup dos JSONs locais** ou confirme que estão no git.
3. **Rodar a migração** com o banco real:
   ```bash
   cd web
   DATABASE_URL="postgresql://..." node database/migrate.js
   ```
   (Isso ainda **nunca foi executado** contra um Neon de verdade.)
4. **Configurar env vars no Vercel** (seção 7) e fazer o **primeiro deploy**.
5. **Teste ponta-a-ponta**: login, carteira, bolões, assinaturas, evolução IA, página de resultados.

### Decisões que o próximo dev precisa tomar

6. **`api_jogos_ia/` (Python)**: o `web/` **não depende mais dela** (o motor genético virou JS
   em `web/lib/genetic_engine.js`). Decidir se: (a) migra o Python para o Vercel (suporta
   FastAPI), (b) mantém num VPS/Render, ou (c) descarta. 
7. **`lotofacil-platform/` (React Native + auth-service + gateway)**: ficou fora deste deploy.
   Decidir se/onde será publicado.

### Melhorias / ajustes recomendados

8. **Cron no plano Hobby roda 1x/dia** (schedule `0 12 * * *`). Assinaturas só serão
   processadas 1x/dia. Se precisar mais, é necessário o plano Pro (ou processar no próprio
   request em casos especiais).
9. **Atualização de resultados (cache)**: no serverless, o refresh em background
   (`fetchLatestLotofacilResult`) é *best-effort* — a instância pode ser congelada após a
   resposta. Alternativas: rodar `node database/seed.js` localmente + `npm run migrate`, ou
   criar um cron extra que chama a atualização de resultados.
10. **Custo de CPU da evolução genética**: o Hobby tem limite de CPU-hours. `autoEvolve` já
    está desligado; a evolução roda só quando o admin usar a página **Evolução IA**.
11. **Remover arquivos lixo do Windows**: existem arquivos `nul` na raiz (`nul`) e em
    `web/nul` (artefatos do Windows). Podem ser deletados.
12. **Testes automatizados**: o projeto **não tem nenhum teste**. Criar smoke tests para a API
    (login, criar jogo, carteira, bolões) seria o ideal antes de produção.
13. **README raiz (`README.md`)** ainda descreve deploy via Docker — atualizar para refletir
    que `web/` agora vai para o Vercel.
14. **Segurança**: `SESSION_SECRET` tem um fallback hardcoded no código — em produção **sempre**
    definir a env var. Revisar também se `cors()` aberto é aceitável.

---

## 7. Variáveis de ambiente (`web/.env.example`)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | Pooled connection string do Neon (com `?sslmode=require`). SSL é **obrigatório** no Neon. |
| `SESSION_SECRET` | ✅ (prod) | Secret das sessões. Gerar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CRON_SECRET` | ✅ (prod) | Segredo do endpoint de cron. O Vercel envia no header `Authorization: Bearer <CRON_SECRET>`. |
| `SITE_URL` | ⚠️ | URL pública do site (usada nos links de compartilhamento). |
| `COOKIE_SECURE` | opcional | Força cookie seguro. No Vercel é automático. |
| `PGSSL` | opcional | `false` apenas para Postgres local sem SSL (dev). **Nunca** no Vercel/Neon. |
| `PG_MAX` | opcional | Tamanho do pool (default 10). |

---

## 8. Rodando localmente

```bash
cd web
cp .env.example .env        # preencha DATABASE_URL (e PGSSL=false se Postgres local sem SSL)
npm install
npm run migrate             # uma vez, para popular o banco
npm run dev                 # http://localhost:3000
```

> ⚠️ **Gotcha do dev local:** o `.env.example` vem com `COOKIE_SECURE=true`, que força cookie
> seguro (HTTPS). Em `http://localhost` o Chrome até aceita, mas em outros hosts a sessão
> **não persiste**. Se o login falhar localmente, coloque `COOKIE_SECURE=false` no `.env`.

## 9. Deploy no Vercel (resumo)

1. Subir o repositório para o Git (a raiz do repo deve conter `web/`).
2. Vercel → **New Project** → importar o repo → **Root Directory: `web`**.
3. Framework Preset: **Other**; Build: `npm run vercel-build`; sem output directory.
4. Configurar as env vars do projeto no Vercel (seção 7).
5. **Deploy**. O `vercel.json` cuida do Express, estáticos e cron.

> Passo a passo completo em **`web/README-VERCEL.md`**.

---

## 10. Notas técnicas / decisões registradas

- **`connect-pg-simple`** cria a tabela `session` automaticamente (`createTableIfMissing` default).
- **Neon exige SSL**: o pool usa `ssl: { rejectUnauthorized: false }` por padrão; `PGSSL=false`
  desativa apenas para dev local.
- **`db.createSubscription`** usa `ON CONFLICT (id) DO UPDATE` → migração idempotente.
- **`vercel-build` é um placeholder** (`console.log('build ok')`): não é bug — o build real é
  feito pelo `@vercel/node` no deploy. O script só existe para satisfazer o campo de build.
- **`PG_MAX`** (tamanho do pool, default 10) é lido pelo `db.js`, mas **não** está no
  `.env.example` — só use se precisar ajustar o pool.
- **`genetic_engine.js`** mantém compatibilidade: se não houver providers (uso standalone),
  continua lendo os JSONs locais.
- O motor genético **roda em JS puro no Node** (portado do Python DEAP) — sem dependência
  externa. A versão Python (`api_jogos_ia/`) é um motor paralelo independente.

---

## 11. Checklist rápido para o novo dev

- [ ] Ler `web/README-VERCEL.md`
- [ ] **Confirmar backup/commit dos `database/*.json`** (fonte da migração)
- [ ] Criar banco no Neon e copiar a pooled URL
- [ ] Rodar `DATABASE_URL=... node database/migrate.js`
- [ ] Deploy no Vercel (root directory `web`)
- [ ] Testar ponta-a-ponta (login → jogo → carteira → bolão → evolução IA)
- [ ] Decidir o futuro de `api_jogos_ia/` e `lotofacil-platform/`
- [ ] Remover arquivos `nul`
- [ ] Atualizar o `README.md` raiz
- [ ] (Recomendado) Criar smoke tests da API
