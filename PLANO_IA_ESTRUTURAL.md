# 🧠 PLANO — IA ESTRUTURAL EM 2 MOTORES (Padrões + Números)

> **STATUS: PLANEJAMENTO — NÃO EXECUTAR ESTE PLANO AUTOMATICAMENTE.**
> Este arquivo é um guia de implementação para um desenvolvedor (ou sessão de IA futura).
> O repositório está LIMPO (nenhuma mudança foi feita para este plano).
> Autor do conceito: dono do produto. Última atualização: 02/08/2026.

---

## 1. OBJETIVO (o que o produto quer, em uma frase)

> **Não tentar prever o resultado do sorteio (isso seria insano e burrice). Otimizar as CHANCES jogando na estrutura e nos números que a estatística mostra como mais prováveis — e distribuir o dinheiro em vários jogos em vez de apostas múltiplas caras.**

A IA tem **DOIS motores de "aprendizado"** que trabalham em sequência:

1. **Motor de PADRÕES (estrutura)** → descobre *qual estrutura de combinação está em vigor AGORA* (com peso nos resultados recentes): faixa de soma, blocos consecutivos, intervalos entre dezenas, paridade.
2. **Motor de NÚMEROS (preenchimento)** → descobre *com o que preencher essa estrutura*: um pool de **~20 dos 25 números** (mistura de quentes + frios em proporção a ser aprendida), usando o motor genético que JÁ EXISTE para escolher dentro do pool.

**O resultado prático:** gerar **bolões com 10 ou 20 jogos** (estrutura quente + números do pool), onde cada apostador paga **R$ 3,50 / R$ 5,00 / R$ 7,00** por cota (usando a tabela de preços já corrigida no banco).

---

## 2. FATOS JÁ VERIFICADOS (não precisa re-provar — dados de 3.750 concursos reais do Neon)

| Fato | Valor | Fonte |
|---|---|---|
| P(≥11 acertos) com 15 dezenas | **10,59%** (fixa p/ QUALQUER combinação) | teoria + 3.750 concursos |
| P(≥11) com 16 dezenas | 22,16% | idem |
| P(≥11) com 18 dezenas | 60,14% | idem |
| P(≥11) com 20 dezenas | 94,35% | idem |
| 10 jogos de 15 dezenas (R$ 35) | **~67% de P(≥11 em PELO MENOS 1)** ⚠️ aprox. (jogos do mesmo pool não são 100% independentes — é limite superior) | 1−(1−0,1059)^10 |
| 16 jogos de 15 dezenas (R$ 56) | **~83%** ⚠️ aprox. (mesma ressalva de independência) | 1−(1−0,1059)^16 |
| 1 jogo de 16 dezenas (R$ 56) | **22,16%** (muito pior que espalhar!) | hipergeométrica |
| Soma das dezenas sorteadas | média 195,1 · **84,7% entre 170–220** · min 133 / max 257 | 3.750 concursos |
| Maior bloco consecutivo no sorteio | **4 → 31,4% · 5 → 27,1% · 3 → 12,7%** (~58% em 4-5) | idem |
| Nº de blocos ≥2 no sorteio | 4 blocos → 41,6% · 3 blocos → 28,1% | idem |
| Intervalo médio entre dezenas sorteadas | **~0,59** (estável em todas as 8 eras) | idem |
| Números quentes (z>1,96) | **10, 20, 25** | idem |
| Números frios (z<−1,96) | **08, 16** | idem |
| Anomalia temporal | **20 quente nas eras 3–6 seguidas** (candidato a investigação) | idem |

**Conclusão estratégica (já validada com o dono):**
- Nenhuma combinação de 15 supera outra matematicamente → **o ganho real está em ESTRUTURA (onde a probabilidade mora) + ESPALHAR JOGOS**.
- Aposta múltipla (16–20 dezenas) é **péssima** vs distribuir o mesmo dinheiro em jogos de 15.
- **Anti-rateio**: combinações impopulares (evitar sequências óbvias, aniversários 1–31, padrões geométricos) dividem prêmio com menos gente quando acertam 14/15.

---

## 3. MAPA DO CÓDIGO EXISTENTE (o que já temos)

| Arquivo | Papel | Funções relevantes |
|---|---|---|
| `web/lib/genetic_engine.js` | Motor genético (pesos por número 1–25) | `simulateGames(weights, nGames, pickCount)` · `createIndividual()` · `normalise()` · `evaluateFitness()` · `evolve()` · `generateGames(quantity, pickCount)` · `getSeed()` |
| `web/lib/context.js` | Estado compartilhado + cache + bootstrap | `getResultsCache()` · `getCurrentSeed()` · `syncMissingResults()` · `hydrateCacheInBackground()` · `generateMockAIGames(quantity, pickCount)` |
| `web/routes/ai.js` | APIs de IA | `GET /api/ai/generate?quantity&pickCount` · `GET /api/ai/seed` · `POST /api/simulate` |
| `web/lib/lottery.js` | Preços e configs | `LOTTERY_CONFIGS` · `getGamePrice(gameType, pickCount)` · `getPriceTable()` · `applyPriceOverrides()` |
| `web/routes/pools.js` | Bolões | `POST /api/pools` (createPoolSchema) · `POST /api/pools/:id/join` |
| `web/routes/bets.js` | Apostas | `POST /api/bets` (calcula preço NO SERVIDOR via `getGamePrice`) |
| `web/routes/games.js` | Portfólio | `POST /api/games` · `POST /api/games/:id/create-pool` · `check-result` |
| `web/lib/validation.js` | Zod | `createGameSchema` · `createBetSchema` · `createPoolSchema` |
| `web/public/js/api.js` | Cliente | `generateAIGames(gameType, quantity, pickCount)` · `saveGame()` · `createPool()` |
| `web/views/bets.ejs` | Tela de apostas (modal IA) | modal "Gerar com IA" (quantidade 1–10, dezenas 15–20) |
| `web/views/simulation.ejs` | Tela de simulação IA | grid de 25 números, `generateAIGames()` |
| `web/views/pools.ejs` | Tela de bolões | lista/criação de bolões |
| `web/db.js` | Postgres | `getResults()` · `getLotteryConfigs()` · tabela `results`, `lottery_config`, `seeds` |
| `web/lib/notifications.js` | Notificações | `addNotification(userId, type, title, message, link)` (usado em pools/bets) |
| `web/lib/gamification.js` | Conquistas | `checkAchievements(userId)` · `getUserLevel(userId)` |
| `web/lib/format.js` | Formatação | `formatBRL(value)` (usado em pools/bets) |

**Preços corrigidos pelo admin no banco (`lottery_config`, confirmado 02/08/2026):**
- Lotofácil: 15=R$ 3,50 · 16=R$ 56 · 17=R$ 476 · 18=R$ 2.856 · 19=R$ 13.566 · 20=R$ 54.264
- Mega-Sena: 6=R$ 6 · ... · 15=R$ 25.025
- Quina: 5=R$ 3 · ... · 15=R$ 9.009

---

## 4. ARQUITETURA PROPOSTA

```
                    ┌─────────────────────────────────────────────┐
                    │            RESULTS CACHE (Postgres)          │
                    │        getResultsCache() / db.getResults()   │
                    └──────────────────┬──────────────────────────┘
                                       │ (todos os concursos, com peso temporal
                                       │  nos mais recentes — "padrão em vigor AGORA")
              ┌────────────────────────▼─────────────────────────┐
              │  MOTOR 1: lib/patterns.js  (NOVO)                │
              │  "Qual estrutura está vigorando?"                │
              │  - faixa de soma (ex.: 170–220)                  │
              │  - blocos consecutivos (ex.: max 4–5)            │
              │  - intervalos entre dezenas (ex.: ~0,59)         │
              │  - paridade (ex.: 7/8)                           │
              │  - anomalias: quando começou/parou (janelas)     │
              └────────────────────────┬─────────────────────────┘
                                       │ estrutura quente
              ┌────────────────────────▼─────────────────────────┐
              │  MOTOR 2: pool de números (NOVO + GA existente)  │
              │  "Com o que preencher?"                          │
              │  - pool de ~20 números (quentes+frios, proporção │
              │    aprendida via backtest)                       │
              │  - genetic_engine.simulateGames() escolhe 15     │
              │    dezenas DENTRO do pool                        │
              └────────────────────────┬─────────────────────────┘
                                       │ N jogos (10 ou 20)
              ┌────────────────────────▼─────────────────────────┐
              │  GERADOR DE BOLÕES                                │
              │  - N jogos com estrutura quente + números do pool │
              │  - anti-rateio (evita padrões populares)          │
              │  - cotas: R$ 3,50 / 5,00 / 7,00                  │
              └──────────────────────────────────────────────────┘
                                       ▲
              ┌────────────────────────┴─────────────────────────┐
              │  SELF-UPDATE: syncMissingResults() → reaprende    │
              │  quando um concurso novo é sincronizado           │
              └──────────────────────────────────────────────────┘
```

---

## 5. PESOS / PADRÕES QUE A IA DEVE "APRENDER" (a lista completa)

| # | Peso/Parâmetro | Pergunta que responde | Como aprender |
|---|---|---|---|
| 1 | **Faixa de soma ativa** | Qual faixa de soma concentra os sorteios AGORA? | janela temporal deslizante (últimos 100–500, decaimento exponencial) |
| 2 | **Perfil de blocos** | Bloco máximo de 4 ou 5? Quantos blocos ≥2? | distribuição empírica ponderada por recência |
| 3 | **Perfil de intervalos** | Intervalo médio típico (~0,59)? | média ponderada por recência |
| 4 | **Paridade ativa** | 7 pares/8 ímpares é o típico? | proporção ponderada |
| 5 | **Pool de números (tamanho)** | Usar 20 dos 25? 18? 22? | backtest: qual tamanho de pool maximiza cobertura sem diluir |
| 6 | **Proporção quentes/frios** | Misturar X% quentes + Y% frios? | backtest out-of-sample (qual split melhora ≥11) |
| 7 | **Anti-rateio** | Quais estruturas a maioria NÃO joga? | heurística (evitar 1–31 aniversários, sequências, geométricos) |
| 8 | **Janela temporal** | Quanto do passado importa (100? 300? 500)? | comparar z-scores entre janelas |

**IMPORTANTE (honestidade):** esses pesos NÃO preveem o próximo sorteio. Eles otimizam *onde você joga* (estrutura de maior densidade de probabilidade) e *como você espalha* (10–20 jogos). O backtest mede isso com **prêmio pago acumulado**, não com "acertou o resultado".

---

## 6. IMPLEMENTAÇÃO PASSO A PASSO (ordem sugerida)

### Passo 1 — Criar `web/lib/patterns.js` (Motor de PADRÕES)

Funções puras e testáveis (recebem `draws` como argumento — array de arrays de 15 números):

```js
// Assinaturas sugeridas:
function extractStructure(draw)            // { sum, maxBlock, nBlocks, avgGap, parity: {odd, even} }
function buildProfile(draws, opts = {})    // janela + decaimento; retorna distribuições ponderadas
   // opts: { windowSize, decayFactor } — ex.: últimos 300 com peso exponencial λ
function getActiveStructure(profile)       // a estrutura "em vigor agora" (faixa soma, blocos, paridade)
function detectAnomalies(draws, eras = 8)  // janelas no tempo + z-scores → { number: [{era, z}] }
function compareToTheoretical(profile)     // observado vs espaço C(25,15) → "padrão real ou acaso"
```

- **FONTE PRIMÁRIA: `getResultsCache()` (hidratado em background).** ⚠️ REGRA RIGOROSA: `db.getResults()` carrega os 3.750 concursos e leva ~13s — estoura o timeout do Vercel Hobby em request paths. Usar `db.getResults()` SOMENTE fora de requisições HTTP (ex.: CLI de backtest, scripts). Nos endpoints, sempre `getResultsCache()` (que já fica 100% hidratado via `hydrateCacheInBackground()`).
- **Peso temporal:** multiplicar cada concurso por `exp(-λ · idade)` ou usar janela deslizante simples; o objetivo é "aprender qual padrão está vigorando AGORA com base no acréscimo do último resultado".
- Comparar com o espaço teórico para nunca vender ruído como padrão.

### Passo 2 — Criar `web/lib/number_pool.js` (Motor de NÚMEROS)

```js
// Assinaturas sugeridas:
function computeNumberScores(draws, opts)   // frequência ponderada por recência (1–25)
function learnPoolSize(draws)               // backtest: 18/20/22 → qual cobre melhor sem diluir
function learnHotColdSplit(draws)           // backtest out-of-sample: proporção quentes/frios
function buildPool(draws, opts)             // → 20 números: { pool, hotShare, rationale }
function pickFromPool(pool, pickCount, seedWeights)  // usa genetic_engine.simulateGames
```

- Reutilizar o **`LotteryGeneticEngine` existente** (`genetic_engine.js`): a semente (25 pesos) vira **peso dentro do pool** — zerar/ignorar pesos fora do pool.
- **Backtest da proporção quentes/frios:** split 50/50, 60/40, 70/30 → qual dá maior taxa de ≥11 fora da amostra. (Empírico já mostrou: quentes levemente melhores, frios PIORES — o split aprendido deve pender para quentes, mas valida-se com dados.)

### Passo 3 — Novo endpoint `POST /api/ai/structured-generate` (em `routes/ai.js`)

Payload sugerido (validar com Zod em `lib/validation.js`):
```json
{ "quantity": 10, "pickCount": 15, "poolSize": 20, "antiRateio": true, "contestNumber": 3005 }
```

Resposta:
```json
{ "success": true, "structure": { "sumBand": [170,220], "maxBlock": "4-5", "parity": "7/8" },
  "pool": [3,5,...], "games": [[...15 nums...], x10], "totalPrice": 35.00,
  "perGamePrice": 3.50, "hotShare": 0.6, "seedVersion": "1.0.structural" }
```

Regras de negócio:
- **Sempre gerar 15 dezenas por jogo** (é a melhor relação custo/chance — validado).
- `totalPrice = quantity × getGamePrice('LOTOFACIL', 15)` (usar a tabela corrigida).
- **Anti-rateio:** rejeitar/repensar combos com ≥6 números seguidos, todos ≤31, ou padrões geométricos óbvios.
- **Cobertura:** distribuir os 20 números do pool pelos 10–20 jogos (cada número aparece ~75% das vezes).

### Passo 4 — Integração com BOLÕES (`routes/pools.js`)

Novo endpoint `POST /api/pools/structured` (ou reutilizar `POST /api/pools` com `games[]`):
- Recebe `{ quantity, sharePriceOptions, ... }` → gera os jogos via Motor 1+2 → cria bolão com:
  - `numbers`: não faz sentido um bolão de 15 só → **alterar schema** para permitir `games: [[...],[...]]` (lista de jogos) OU criar 1 bolão por jogo.
  - **MIGRAÇÃO DE BANCO OBRIGATÓRIA** (padrão já usado em `db.js` para `bets.game_id`): `ALTER TABLE pools ADD COLUMN IF NOT EXISTS games JSONB;` — depois atualizar `db.createPool()`, `mapPool()` e a renderização em `pools.ejs`.
  - **Decisão a validar com o dono (SEMÂNTICA DA COTA):** um bolão com 10 jogos (participante compra "cota do bolão inteiro") vs 10 bolões de 1 jogo. Se for 1 bolão com N jogos: decidir se **cota = valor de 1 jogo** (R$ 3,50 → `totalShares = quantity`, `sharePrice = 3,50`) ou **cota = fração do total** (R$ 35 total → cota R$ 3,50 = 10% → `totalShares = 10`). Isso muda `sharePrice`, `maxShares` e o cálculo de `availableShares` em `pools.js` — documentar ANTES de codar.
- Debita da carteira do criador (`db.adjustUserBalance`), registra transação, notificação (padrão já existente em `pools.js` — requer `addNotification` de `lib/notifications.js`, `checkAchievements` de `lib/gamification.js`, `formatBRL` de `lib/format.js`).

### Passo 5 — Self-update (o "IA que se atualiza sozinha")

Em `web/lib/context.js`, dentro de `syncMissingResults()` (e `hydrateCacheInBackground()`), depois de salvar o concurso novo:
```js
// após salvar o resultado novo:
patternsEngine.learn(getResultsCache());   // reaprende estrutura "em vigor agora"
numberPoolEngine.learn(getResultsCache()); // reaprende pool + proporção
```
- Persistir o estado aprendido numa tabela nova `pattern_state` (em `db.js`): `{ id, payload, updated_at }` — igual ao padrão da tabela `seeds`.
- Carregar no bootstrap (`context.js`) como já é feito com `getSeed('LOTOFACIL')`.

### Passo 6 — UI

- **`views/bets.ejs`**: no modal "Gerar com IA", adicionar opção "Estrutura + Pool (10/20 jogos)" com seletor de quantidade (10/20), exibindo preço total (tabela corrigida) e os padrões ativos (soma, blocos, pool).
- **`views/pools.ejs`**: botão "Criar bolão com IA" → gera os jogos e abre o form de bolão pré-preenchido com cotas de R$ 3,50 / 5,00 / 7,00 (renderizar `games[]` após a migração).
- **`views/simulation.ejs`**: painel "Estrutura em vigor" mostrando os padrões aprendidos + anomalias (quando 20 ficou quente, etc.).
- **`public/js/api.js`**: `structuredGenerate(payload)` e `createStructuredPool(payload)`.

### Passo 7 — Testes (Vitest — suíte já existente em `web/tests/`)

- `web/tests/patterns.test.js`: `extractStructure` (soma/blocos/paridade de um sorteio conhecido), `buildProfile` (estável com dados sintéticos), `compareToTheoretical` (dados sintéticos uniformes → "sem desvio").
- `web/tests/number_pool.test.js`: `buildPool` retorna 20 números válidos; `pickFromPool` gera 15 únicos dentro do pool.
- `web/tests/ai.test.js` (estender): `POST /api/ai/structured-generate` → 200, `games.length === quantity`, cada jogo 15 únicos em 1–25, `totalPrice` correto com a tabela.
- `web/tests/pools.test.js` (estender): criação de bolão estruturado debita saldo e persiste.
- Rodar: `npx vitest run` (65 testes existentes devem continuar passando) + `npx eslint` nos arquivos novos.

### Passo 8 — Backtest honesto de prêmio (validação do produto)

- Endpoint `GET /api/strategy/backtest` (ou ferramenta CLI `web/scripts/backtest.js`):
  - Walk-forward: para cada concurso N, usa só 1..N−1 para aprender estrutura+pool, gera jogos, verifica no concurso N.
  - Mede **prêmio acumulado** (tabela `PRIZE_TABLES` da Caixa) vs custo (tabela corrigida) → ROI real.
  - Mostra na UI: "esta estratégia pagou R$ X para cada R$ Y jogados" — **sem prometer previsão**.

---

## 7. O QUE NÃO FAZER (armadilhas já identificadas)

- ❌ **Não** otimizar o GA contra os últimos 300 com pesos 1/10/100/1000/10000 (persegue ruído — é o que existe hoje).
- ❌ **Não** usar a janela de 300 concursos como se fosse "o padrão" — usar TODOS com peso temporal nos recentes.
- ❌ **Não** vender a ideia de "prever o sorteio" na UI — o app deve dizer: *"estrutura + espalhamento otimizam suas chances, não garantem resultado"*.
- ❌ **Não** recomendar apostas múltiplas (16–20 dezenas) como "melhor chance" — os dados mostram que espalhar em jogos de 15 é muito melhor por real.
- ❌ **Não** ignorar o preço corrigido: tudo deve passar por `getGamePrice()` (já lê a tabela do admin).
- ❌ **Não** usar os 25 números em toda combinação — o pool de ~20 é um padrão a ser aprendido (18? 20? 22?).

---

## 8. DECISÕES PENDENTES (validar com o dono antes de implementar)

1. **Bolão**: 1 bolão com N jogos vs N bolões de 1 jogo? (recomendação: 1 bolão com N jogos) — **e a semântica da cota**: cota = valor de 1 jogo (R$ 3,50 → `totalShares = quantity`) ou cota = fração do total (R$ 35 → cota R$ 3,50 = 10%)? Ver Passo 4 (as duas opções estão lá em detalhe).
2. **Tamanho do pool**: 18, 20 ou 22 números? (backtest decide — 20 é o palpite inicial)
3. **Split quentes/frios**: proporção inicial 60/40? (backtest out-of-sample valida)
4. **Janela temporal**: 100, 300 ou 500 concursos com decaimento? (comparar z-scores)
5. **Anti-rateio**: aceitar "rejeitar" combos óbvios até que grau? (6 seguidos? todos ≤31?)
6. **UI onde**: modal em /apostas, botão em /boloes, painel em /simulacao — todos os três?

---

## 9. RESUMO EXECUTIVO PARA QUEM VAI EXECUTAR

> **Dois motores:** (1) `lib/patterns.js` descobre a estrutura em vigor (soma 170–220, blocos 4–5, intervalos ~0,59, paridade 7/8) com peso nos concursos recentes; (2) pool de ~20 números (quentes+frios em proporção aprendida) preenchido pelo `genetic_engine.js` que já existe. **Saída:** N jogos de 15 dezenas (N=10 ou 20) que alimentam um bolão com cotas de R$ 3,50/5,00/7,00 usando a tabela de preços já corrigida. **Self-update:** ao sincronizar concurso novo, reaprende estrutura+pool. **Validação:** backtest walk-forward mede prêmio pago vs custo (ROI), sem prometer previsão. **Começar por:** Passo 1 (patterns.js) + testes; depois Pool, endpoint, bolão, UI, backtest. **Não executar tudo de uma vez** — validar cada passo com o dono.
