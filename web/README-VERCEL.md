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
- O motor genético (IA) continua rodando **no Node** (JS puro), carregando histórico
  e semente do Postgres. A evolução não roda automaticamente a cada cold start
  (economiza CPU do plano Hobby) — use a página **Evolução IA** (admin) quando quiser.
- A API Python (`api_jogos_ia/`) e o app React Native não fazem parte deste deploy;
  se quiser publicá-los também, me avise.
