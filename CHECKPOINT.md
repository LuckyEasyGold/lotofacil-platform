# 🎲 CHECKPOINT - Plataforma Lotofácil

> Última atualização: 01/08/2026
> Este arquivo documenta o estado atual do projeto para recuperação rápida em caso de travamento.

---

## 📋 Status Geral

| Item | Status |
|------|--------|
| Servidor rodando na porta 3000 | ✅ OK |
| Login com credenciais de acesso (ver responsável do projeto) | ✅ OK |
| Todas as páginas retornam HTTP 200 | ✅ OK |
| Motor genético carregado (gen 45, fitness 145.23) | ✅ OK |
| Cache de 3.750 concursos (até #3750, 31/07/2026) | ✅ OK |
| Sessão de login: 30 dias (quem já logou entra direto) | ✅ OK |
| Banco de dados: Neon (Postgres serverless, SSL) | ✅ OK |

---

## ✅ Últimas Correções Realizadas

### 6. Cache progressivo de resultados + IA com histórico completo
- **Problema:** o cache carregava só os últimos 500 concursos (comentário desatualizado de "13s"
  da época do JSON) e a fitness da IA comparava só contra os últimos 100 — a IA não aprendia
  com todos os 3.750 concursos disponíveis no Neon.
- **Correção:** `web/server.js` agora carrega só os 100 mais recentes no boot (tela rápida) e
  hidrata o resto em lotes de 500 em background (com pausa de 60ms), com reconciliação final
  (~711ms) e sincronização incremental via API da Caixa (só os concursos que faltam).
  No Vercel (serverless) o histórico completo é carregado de forma síncrona (~711ms), pois
  timers de background congelam após a resposta.
- **IA:** `web/lib/genetic_engine.js` ganhou `FITNESS_WINDOW_SIZE` configurável (default 300,
  antes fixo em 100). `contestsAnalyzed` agora chega a 3750.
- **Arquivos:** `web/server.js`, `web/db.js` (novos `getResultsCount`/`getResultsWindow`),
  `web/lib/genetic_engine.js`

### 7. Sessão de login longa (30 dias)
- **Problema:** sessão expirava em 24h — usuário que já havia logado precisava logar de novo.
- **Correção:** `web/server.js` — cookie de sessão com `maxAge` de 30 dias (configurável via
  `SESSION_MAX_AGE_DAYS`). `/login` redireciona direto pro dashboard quando há sessão ativa.
- **Arquivos:** `web/server.js`, `web/README-VERCEL.md`

### 8. Ambiente local (.env.local)
- **Problema:** `dotenv` carregava só `.env` — o `.env.local` (gerado pelo `vercel env pull`)
  era ignorado e a `DATABASE_URL` ficava vazia em dev local.
- **Correção:** `web/server.js` e `web/db.js` agora também carregam `.env.local` (com
  `override: true` e `quiet: true`), sem quebrar produção (onde o arquivo não existe).
- **Arquivos:** `web/server.js`, `web/db.js`

### 9. Login com Google — esclarecimento (nenhum código)
- **Não há login social no app.** A tela de "logar com Google" ao abrir os links de preview
  (`*-git-main-*.vercel.app`) é a **Vercel Authentication (Deployment Protection)**, não o app.
  A URL correta para usuários é a de produção: `https://lotofacil-platform.vercel.app`.

### 10. Migração completa para UUID
- **Problema:** IDs sequenciais (`'1'`, `'2'`) em users/games/pools/conquistas — segurança
  (enumeração de recursos) e sem padronização.
- **Correção:** migração completa (seed + produção) executada em transação com cascata:
  `users`, `games` (user_id + pool_id), `transactions`, `bets`, `notifications`,
  `subscriptions`, `user_achievements`, `pools` — todos agora com UUID.
- **UUIDs fixos:** admin `9d961bea-5ffe-460a-9f31-a4738f97794b`, maria
  `5a571785-7d12-4c05-8a06-fd66fa50265c`, bolão 1 `974eb2c7-002b-41dc-902b-880d0cc362e3`,
  bolão 2 `3f1daf61-8a33-498f-be64-cbd92fdb530e`.
- **Sessões antigas:** quem estava logado antes da migração é redirecionado ao `/login`
  (as sessões guardavam id `'1'/'2'`). Basta logar de novo.
- **Arquivos:** `web/database/users.json`, `games.json`, `achievements.json`,
  `web/server.js`, `web/database/migrate.js`, `web/test_*.js`

### 11. Suíte de testes (Vitest + Supertest)
- **Problema:** zero testes no projeto inteiro; regressões silenciosas só eram
  pegas testando manualmente (ex.: `contestsAnalyzed: 0` no Vercel).
- **Correção:** criada infraestrutura completa de testes de API em `web/tests/`:
  34 testes em 5 arquivos (auth 8, games 9, wallet 6, pools 5, results 6).
- **Infra:** `vitest.config.js` (sequencial, singleFork), `tests/setup.js`
  (define `VERCEL=1`/`NODE_ENV=test` antes do import do server.js — exporta o app
  sem abrir porta), `tests/helpers.js` (`registerUser` + `cleanupTestData` +
  cliente `api`).
- **Detalhe:** cookie de sessão agora respeita `NODE_ENV=test` (Secure desligado
  para o supertest); bootstrap em modo teste carrega 100 resultados + semente da
  IA (pula o histórico completo de 3750 — suíte fica rápida/estável).
- **Comandos:** `npm test`, `npm run test:watch`, `npm run check`.
- **Docs:** guia completo em `web/DOCS.md` §6.

### 12. Documentação oficial (web/DOCS.md)
- Criado `web/DOCS.md` — guia técnico completo: arquitetura, modelo de dados,
  referência de API (todas as rotas), testes, convenções de código, segurança,
  decisões de arquitetura (incl. por que NÃO usar htmx) e onboarding.
- README.md atualizado (seções de testes e documentação).

### 13. Refatoração do server.js em routers (lib/ + routes/)
- **Problema:** `server.js` monolítico com ~1939 linhas (69 rotas + estado + bootstrap) —
  difícil de navegar e manter para novos devs.
- **Correção:** estado/lógica compartilhada extraída para `lib/` (context, auth,
  lottery, gamification, subscriptions, notifications, http, validation) e as
  rotas divididas em 16 routers por domínio em `routes/` (auth, pages, admin,
  ai, dashboard, bets, games, wallet, pools, results, notifications,
  subscriptions, gamification, share, stats, profile). `server.js` virou
  composição (config + sessão + mount + erro).
- **Detalhe crítico:** `resultsCache`/`currentSeed` são `let` reatribuídos no
  boot — expostos como **getters** `getResultsCache()`/`getCurrentSeed()` para
  não congelar a referência; guards `ensureReady()` preservados nas funções de
  cache. Ordem de rotas preservada (`/api/games/:id` por último).
- **Arquivos:** `web/lib/*.js` (novos), `web/routes/*.js` (novos), `web/server.js`

### 14. Testes de IA (tests/ai.test.js)
- 8 testes novos cobrindo geração IA, simulação, seed, lucky-numbers, 401 e
  admin 403. Suíte total: **42 testes em 6 arquivos**.

### 15. Validação Zod (lib/validation.js)
- Schemas Zod (v4.4.3) para auth, games, wallet, pools, bets, simulate, evolve,
  subscriptions e profile — mensagens em pt-BR e 400 automático via middleware
  `validate()`. Validações de negócio (saldo/cotas/permissão) continuam nos
  handlers.
- **Mudança de comportamento (intencional):** `/api/bets` agora exige `amount`
  positivo; `evolve` rejeita `generations` não numérico (antes usava default 10).

### 16. ESLint + Prettier
- ESLint flat config (`eslint.config.js`, CommonJS + testes ESM) + Prettier
  (`.prettierrc.json`). Scripts: `npm run lint`, `npm run lint:fix`,
  `npm run format`, `npm run format:check`. Lint limpo (0 erros).


### 1. simulation.ejs - Bug saveGameToPortfolio
- **Problema:** Chave `name` duplicada e variável `count` inexistente
- **Correção:** Removeu linha duplicada; agora salva jogos IA corretamente no portfólio
- **Arquivo:** `web/views/simulation.ejs`

### 2. pools.ejs - Nome hardcoded + EJS dentro de backtick
- **Problema:** `'João Silva'` fixo no código + `<%- JSON.stringify %>` dentro de backtick
- **Correção:** Nome dinâmico do usuário logado; pré-cálculo de variáveis antes do backtick
- **Arquivo:** `web/views/pools.ejs`

### 3. bets.ejs - Erro silencioso no catch
- **Problema:** `catch(e) {}` engolia erro ao salvar jogo no portfólio
- **Correção:** Adicionado `console.warn` + `showToast('info')`
- **Arquivo:** `web/views/bets.ejs`

### 4. profile.ejs - EJS dentro de backtick
- **Problema:** `<%= %>` dentro de backtick causava HTTP 500
- **Correção:** Pré-cálculo de variáveis financeiras antes do backtick
- **Arquivo:** `web/views/profile.ejs`

### 5. my-games.ejs - Backtick aninhado
- **Problema:** Template literal JS dentro do body backtick
- **Correção:** Substituído por concatenação de strings
- **Arquivo:** `web/views/my-games.ejs`

---

## 🚧 IMPLEMENTAÇÃO DE 10 FUNCIONALIDADES

### FASE 1 — Estatísticas Avançadas ✅ CONCLUÍDA
- [x] Heatmap dos números mais frequentes (5x5 com gradiente de cor)
- [x] Números Quentes vs Frios (mais/menos sorteados)
- [x] Análise de Atraso (números há mais tempo sem sair)
- [x] API endpoint `/api/stats/advanced`
- [x] Página `/estatisticas` criada (stats.ejs)
- [x] Link no sidebar (seção Principal)
- [x] Método `getAdvancedStats` no api.js

### FASE 2 — Dashboard Turbinada ✅ CONCLUÍDA
- [x] Widget "Números da Sorte do Dia" (frequência + IA)
- [x] Widget "Cobertura do Portfólio" (heatmap 5x5, % cobertura)
- [x] Previsão de números não cobertos / complementares
- [x] API endpoints: /api/dashboard/lucky-numbers, /api/dashboard/portfolio-insights
- [x] Métodos no api.js: getLuckyNumbers, getPortfolioInsights

### FASE 3 — Comparador de Jogos ✅ CONCLUÍDA
- [x] Checkbox em cada card de jogo para seleção
- [x] Botão "Comparar Selecionados"
- [x] Similaridade entre pares (Índice Jaccard)
- [x] Cobertura combinada (números distintos dos jogos)
- [x] Números únicos por jogo
- [x] Sugestão de números complementares (não cobertos)
- [x] API endpoint: /api/games/compare
- [x] Método no api.js: compareGames

### FASE 4 — Sistema de Notificações ✅ CONCLUÍDA
- [x] `addNotification()` no servidor (armazenamento em memória)
- [x] Bell dropdown com badge na topbar (layout.ejs)
- [x] Painel de notificações com lista, toggle e outside-click
- [x] Notificação when jogo é premiado (check-result com hits >= 11)
- [x] API: GET /api/notifications, POST /:id/read, POST /read-all
- [x] Métodos no api.js: getNotifications, readNotification, readAllNotifications

### FASE 5 — Múltiplas Loterias ✅ CONCLUÍDA
- [x] LOTTERY_CONFIGS com 4 tipos (Lotofácil, Mega-Sena, Quina, Lotomania)
- [x] PRIZE_TABLES com premiações por loteria
- [x] Validação de jogos usa cfg.pickCount e cfg.totalNumbers (dinâmico)
- [x] bets.ejs: grade de números se adapta (5 colunas para LF, 10 para as demais)
- [x] bets.ejs: quickPick, confirmBet, useAIGenerate usam currentGame
- [x] bets.ejs: loadFromPortfolio filtra por gameType
- [x] api.js: getGames aceita gameType como filtro
- [x] server.js: /api/games filtra por gameType

### FASE 6 — Exportação de Dados ✅ CONCLUÍDA
- [x] Exportar jogos do portfólio para CSV
- [x] Botão de download na página Meus Jogos
- [x] Relatório de desempenho do portfólio (com preço dinâmico por loteria)

### FASE 7 — Mercado de Cotas ✅ CONCLUÍDA
- [x] Usuários podem vender cotas de bolões (botão "Vender Cotas")
- [x] Feed de ofertas ativas nos cards "Meus Bolões"
- [x] Comprar cotas de outros usuários (botão "Comprar")
- [x] APIs: createOffer, buyOffer

### FASE 8 — Apostas Recorrentes ✅ CONCLUÍDA
- [x] Assinar jogo para rodar automaticamente (UI em Configurações)
- [x] Gerenciar assinaturas ativas (listar, criar, cancelar)
- [x] Débito automático da carteira (auto-renovação a cada 60s)
- [x] APIs: POST/GET/DELETE /api/subscriptions

### FASE 9 — Gamificação ✅ CONCLUÍDA
- [x] Sistema de 16 medalhas/conquistas
- [x] Nível do usuário (baseado em XP)
- [x] Widget de nível na Dashboard + Perfil
- [x] Grid de conquistas no Perfil
- [x] Conquistas automáticas: criar jogos, usar IA, bolões, prêmios, assinaturas, exportar
- [x] Notificação ao desbloquear conquista

### FASE 10 — Compartilhamento Social ✅ CONCLUÍDA
- [x] Compartilhar estatísticas do portfólio (WhatsApp, Telegram, Twitter)
- [x] Compartilhar bolão via link
- [x] Botão "Compartilhar" em Meus Jogos e Bolões
- [x] Widget de bolões populares na Dashboard
- [x] APIs: shareGame, sharePool, shareStats

---

## 📝 Notas Importantes

- **Auto-renovação de assinaturas**: Verifica a cada 60 segundos se há assinaturas ativas. Para produção, aumentar para 1 hora.
- **checkAchievements**: Chamado em endpoints estratégicos (criar jogo, join pool, ganhar prêmio, criar assinatura, exportar CSV).
- **export_first**: Concedido manualmente no endpoint de exportação CSV.
- **share_first**: Concedido manualmente no endpoint shareGame.
- **Preço dinâmico**: Relatório de desempenho agora usa o preço real de cada loteria (R$3 Lotofácil, R$5 Mega-Sena, etc.).

## 🐛 Bugs Conhecidos

Nenhum conhecido no momento.

---

## 🔧 Como Reiniciar o Servidor

```bash
cd /c/projetos/sfg/web
npm start        # node server.js
# Acessar: http://localhost:3000
```

> O `server.js`/`db.js` carregam `.env.local` (prioridade) e `.env`. Se a `DATABASE_URL`
> não estiver definida, o servidor sobe mas não conecta no banco — preencha o `.env.local`
> com a connection string do Neon (pooled, com SSL).

## 🔐 Contas de Teste

> ⚠️ As credenciais de acesso não ficam mais registradas neste documento nem no
> código-fonte (medida de segurança). As senhas das contas demo foram rotacionadas
> e são repassadas apenas diretamente ao responsável pelo projeto.

## 📁 Arquivos Modificados Recentemente

- `web/routes/` — **novo**: 16 routers por domínio (refatoração do server.js)
- `web/lib/` — **novo**: context, auth, lottery, gamification, subscriptions, notifications, http, validation
- `web/tests/ai.test.js` — **novo**: 8 testes de IA (suíte total: 42)
- `web/lib/validation.js` — **novo**: schemas Zod + middleware validate()
- `web/eslint.config.js`, `web/.prettierrc.json` — **novos**: ESLint flat + Prettier
- `web/DOCS.md` — **novo**: guia técnico oficial (arquitetura, API, testes, onboarding, ADRs)
- `web/tests/` — suíte Vitest + Supertest (42 testes em 6 arquivos)
- `web/vitest.config.js` — config do Vitest (sequencial, singleFork)
- `web/package.json` — scripts `test`, `test:watch`, `check`, `lint`, `format` + devDeps
- `web/server.js` — reescrito como composição (routers); cookie Secure respeita NODE_ENV=test; UUIDs
- `web/db.js` — suporte a `TEST_DATABASE_URL`; `getResultsCount`/`getResultsWindow`
- `web/database/*.json` — UUIDs nos seeds (users, games, achievements)
- `web/lib/genetic_engine.js` — `FITNESS_WINDOW_SIZE` configurável (default 300)
- `web/README-VERCEL.md` — documenta cache progressivo, env vars e sessão
- `README.md` — seções de testes, lint e documentação; env vars, URL de produção
- `web/views/*.ejs` — correções de EJS/backtick das rodadas anteriores
