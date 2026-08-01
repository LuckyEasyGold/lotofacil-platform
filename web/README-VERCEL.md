# 🚀 Deploy no Vercel + Neon

A plataforma `web/` foi migrada de persistência em **arquivos JSON + memória** para
**PostgreSQL gerenciado (Neon)**, ficando compatível com o modelo serverless do Vercel
(filesystem read-only + instâncias efêmeras).

## O que mudou

| Antes | Depois |
|---|---|
| `database/*.json` (users, games, subscriptions, etc.) | Tabelas no Postgres (Neon) |
| `express-session` em memória | Sessões no Postgres (`connect-pg-simple`) |
| `setInterval` para assinaturas (60s) | Vercel Cron (`/api/cron/process-subscriptions`) |
| Semente/evolução da IA em `seeds.json` | Semente persistida no Postgres (tabela `seeds`) |
| `app.listen` direto | `module.exports = app` (Express serverless) |

## Passo a passo

### 1. Criar o banco no Neon

1. Acesse [console.neon.tech](https://console.neon.tech) e crie um projeto.
2. Copie a **Pooled connection string** (hostname termina em `-pooler.neon.tech`),
   com `?sslmode=require`. Ex:
   ```
   postgresql://user:pass@ep-xxxx-pooler.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```

### 2. Migrar os dados locais (uma vez)

```bash
cd web
npm install
# copie .env.example para .env e preencha DATABASE_URL
DATABASE_URL="postgresql://..." node database/migrate.js
```

O script importa usuários, jogos, assinaturas, conquistas, resultados (lotofacil.json)
e a semente da IA para o Postgres.

### 3. Variáveis de ambiente no Vercel

Configure no projeto (Settings → Environment Variables):

- `DATABASE_URL` — a connection string do Neon (pooled, com SSL)
- `SESSION_SECRET` — gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `CRON_SECRET` — segredo para o cron de assinaturas
- `SITE_URL` — URL pública (ex: `https://seu-site.vercel.app`)
- `SESSION_MAX_AGE_DAYS` — opcional; dias de validade da sessão (default `30`).
  Quem já fez login antes entra direto no dashboard sem novo login dentro desse período.

### 4. Deploy

1. Faça push do projeto (raiz que contém `web/`) para um repositório Git.
2. No Vercel: **New Project** → importe o repo → **Root Directory**: `web`.
3. Framework Preset: **Other**. Build: `npm run vercel-build`. Output: padrão.
4. **Deploy**. O `vercel.json` já configura o Express, os assets estáticos e o cron.

> No plano Hobby, o cron roda no máximo **1x por dia** (configurado `0 12 * * *`).
> No plano Pro, pode rodar a cada minuto — ajuste a schedule em `vercel.json`.

## Desenvolvimento local

```bash
cd web
cp .env.example .env   # preencha DATABASE_URL
npm install
npm run migrate        # uma vez
npm run dev            # http://localhost:3000
```

Se usar Postgres local via Docker sem SSL, adicione `PGSSL=false` no `.env`.

## Notas

- `/api/results/latest` prioriza o cache no Postgres e atualiza em segundo plano via
  APIs externas — no serverless esse refresh em background é *best-effort* (a instância
  pode ser congelada após responder). Para atualizar o cache, rode `node database/seed.js`
  localmente e `npm run migrate` quando quiser sincronizar os concursos mais recentes.

### Cache progressivo de resultados

O cache em memória **não carrega mais tudo de uma vez no boot**:

1. **Boot rápido** — carrega só os **100 concursos mais recentes** (primeira tela instantânea).
2. **Hidratação em background** — em lotes de 500 (com pausa de 60ms entre lotes para não
   travar o event loop), o cache é preenchido até o histórico completo do Postgres;
   ao final, o motor da IA é recarregado para aprender com **todos** os concursos.
3. **Reconciliação** — se algum concurso antigo for inserido no meio da hidratação
   (ex.: `/api/results/500` chamado logo após o boot), o cache é realinhado
   (recarga completa, ~711ms) para nunca ficar com buracos.
4. **Sincronização incremental** — no boot, consulta a Caixa (fonte oficial) e salva
   apenas os concursos que faltam (`#último+1 → #mais_recente`, cap 30 por execução).
5. **Fallback sob demanda** — se um concurso não está no cache (ex.: instância
   congelada antes de hidratar), busca no Postgres e depois nas APIs, como na primeira vez.

### Aprendizado da IA (janela de fitness)

O motor genético avalia a fitness contra os **N concursos mais recentes**, configurável
por env `FITNESS_WINDOW_SIZE` (default **300**):

| Janela | Tempo por evolução (100pop × 20gen) |
|---|---|
| 100 | ~4 min |
| 300 (default) | ~6 min |
| 500 | ~9,6 min |
| 3750 (tudo) | ~55 min |

Janela maior = aprendizado mais amplo, porém evolução mais lenta. Para evolução rápida
use `FITNESS_WINDOW_SIZE=100`; para aprendizado máximo, `FITNESS_WINDOW_SIZE=3750`.

- O motor genético (IA) continua rodando **no Node** (JS puro), carregando histórico
  e semente do Postgres. A evolução não roda automaticamente a cada cold start
  (economiza CPU do plano Hobby) — use a página **Evolução IA** (admin) quando quiser.
- A API Python (`api_jogos_ia/`) e o app React Native não fazem parte deste deploy;
  se quiser publicá-los também, me avise.
