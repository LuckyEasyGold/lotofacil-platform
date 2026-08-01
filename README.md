# 🎲 Lotofácil Platform
Plataforma completa de loterias com **inteligência artificial** para geração de jogos, gestão financeira, bolões e simulação de resultados. Desenvolvido com **Node.js**, **React Native (Expo)** e **Python (FastAPI)**, com deploy pronto para **Vercel + Neon**.

## 🚀 Funcionalidades
- **Geração de Jogos com IA**: Motor genético com análise estatística dos últimos concursos para sugerir jogos otimizados
- **Múltiplas Loterias**: Lotofácil, Mega Sena, Quina, Lotomania, Dupla Sena, Timemania, Dia de Sorte, Super Sete, Federal
- **Carteira Digital**: Depósitos, saques, transferências, compra/venda de cotas de bolão
- **Simulador de Resultados**: Teste seus jogos contra os últimos concursos
- **Bolões**: Crie, participe e gerencie bolões com mercado de cotas
- **Assinaturas Recorrentes**: Apostas automáticas com débito na carteira
- **Gamificação**: 16 conquistas, níveis e XP
- **Estatísticas Avançadas**: Heatmap, números quentes/frios, análise de atraso, comparador de jogos
- **Notificações**: Alertas de prêmios, bolões e conquistas
- **Compartilhamento Social**: WhatsApp, Telegram e Twitter

## 📋 Pré-requisitos
Antes de começar, certifique-se de ter instalado:
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [Git](https://git-scm.com/)
- [VS Code](https://code.visualstudio.com/) (editor recomendado)
- [PostgreSQL](https://www.postgresql.org/) ou [Docker](https://www.docker.com/) (para o banco local)
- [Expo Go](https://expo.dev/go) no celular (para o app mobile)

## 🛠️ Instalação — Plataforma Web (`web/`)
### Passo 1: Suba o Postgres (Docker)
```bash
docker run -d --name lotofacil-pg \
  -e POSTGRES_PASSWORD=<sua-senha> \
  -e POSTGRES_DB=lotofacil \
  -p 5432:5432 postgres:15-alpine
```
### Passo 2: Configure o ambiente
```bash
cd web
npm install
cp .env.example .env   # preencha DATABASE_URL, SESSION_SECRET, CRON_SECRET, SITE_URL
# Opcional: se preferir, use um arquivo .env.local — o dotenv também carrega ele
# (com prioridade sobre o .env). É o formato que o `vercel env pull` gera.
```

Env vars suportadas (todas opcionais, com default):
- `SESSION_MAX_AGE_DAYS` — validade da sessão em dias (default `30`; quem já logou
  entra direto no dashboard sem novo login dentro desse período)
- `FITNESS_WINDOW_SIZE` — janela de concursos que a IA usa no treinamento
  (default `300`; `100` = evolução rápida ~4min, `3750` = aprendizado máximo ~55min)
- `PGSSL=false` — apenas para Postgres local sem SSL
- `COOKIE_SECURE=false` — apenas para dev local em HTTP
### Passo 3: Migre os dados (importa os JSONs locais para o Postgres)
```bash
npm run migrate
```
> ⚠️ Os arquivos `web/database/*.json` (fonte da migração) **não estão versionados** no repositório. Se você clonou o projeto e não tem os JSONs, faça um backup/restore do banco ou peça os dados ao time. Se tiver os JSONs localmente, a migração importa tudo automaticamente.
### Passo 4: Rode o servidor
```bash
npm run dev    # ou npm start → http://localhost:3000
```
> ⚠️ Em dev local, use `COOKIE_SECURE=false` no `.env` (senão a sessão não persiste em HTTP).

### Execução com scripts automáticos
- **Windows**: `start.bat`
- **Linux/macOS**: `./start.sh`

## 🏃 Como Rodar o App Mobile (`lotofacil-platform/loteria-ai-app/`)
```bash
cd lotofacil-platform/loteria-ai-app
npm install
npm start        # inicia o Expo DevTools
```
Escaneie o QR code com o **Expo Go** ou pressione `w` para abrir no navegador. Alternativa automatizada: `.\inicial.ps1` (Windows).

## 📁 Estrutura do Projeto (Monorepo)
```
├── web/                        # Plataforma web (Node.js + Express + EJS + Postgres)
│   ├── server.js               # Composição: config + sessão + mount dos routers
│   ├── lib/                    # Estado/lógica compartilhada (context, auth, validation...)
│   ├── routes/                 # Routers por domínio (auth, games, wallet, pools...)
│   ├── db.js                   # Camada de persistência PostgreSQL (Neon)
│   ├── lib/genetic_engine.js   # Motor genético (IA)
│   ├── tests/                  # Suíte Vitest + Supertest (42 testes)
│   ├── views/                  # Telas em EJS
│   ├── public/                 # Estáticos (CSS, JS)
│   ├── database/               # Migrações e seed
│   └── README-VERCEL.md        # Guia completo de deploy Vercel + Neon
├── api_jogos_ia/               # Motor de IA em Python (FastAPI + algoritmo genético)
│   └── loteria_ai_engine/      # Código do engine Python
├── lotofacil-platform/         # App mobile + serviços + páginas HTML
│   ├── loteria-ai-app/         # App React Native (Expo + TypeScript)
│   ├── services/               # Microserviços (auth-service, gateway)
│   ├── contracts/              # Contratos das APIs (YAML)
│   ├── shared/                 # Convenções e códigos de erro
│   └── *.html                  # Páginas HTML da plataforma
├── deploy/                     # Deploy na Oracle Cloud (nginx + setup)
├── docker-compose.yml          # Orquestração completa (web + IA + Postgres + Redis + Nginx)
├── HANDOVER.md                 # Documento de repasse do projeto
└── CHECKPOINT.md               # Estado atual e correções recentes
```

## 🎨 Tecnologias Utilizadas
- **Node.js + Express + EJS** — Plataforma web
- **PostgreSQL (Neon)** — Banco de dados gerenciado com SSL
- **React Native + Expo + TypeScript** — App mobile
- **Python + FastAPI** — Motor de IA (algoritmo genético)
- **connect-pg-simple** — Sessões persistentes no Postgres
- **Docker + Nginx** — Deploy tradicional / orquestração
- **Vercel** — Deploy serverless da plataforma web
- **Vitest + Supertest** — Testes de API (web)

## 🧪 Testes (Web)
A plataforma web tem uma suíte de testes de API com **Vitest + Supertest**
(42 testes cobrindo autenticação, jogos, carteira, bolões, resultados e IA):

```bash
cd web
npm test          # roda a suíte completa
npm run test:watch  # modo watch (desenvolvimento)
npm run check     # checagem de sintaxe de server.js/db.js
npm run lint      # ESLint (flat config)
npm run format    # Prettier (formata lib/, routes/, tests/, server.js)
```

Os testes criam usuários únicos com timestamp e os apagam no final — não
poluem dados reais. Para isolar dos dados de produção, defina `TEST_DATABASE_URL`
no `.env.local`. Guia completo (como rodar, cobrir e adicionar testes):
[`web/DOCS.md`](web/DOCS.md) §6.

## 📚 Documentação
- [`web/DOCS.md`](web/DOCS.md) — **guia técnico oficial**: arquitetura, modelo de
  dados, referência completa da API (todas as rotas), testes, convenções de
  código, segurança, decisões de arquitetura (ADRs) e onboarding
- [`web/README-VERCEL.md`](web/README-VERCEL.md) — deploy Vercel + Neon
- [`HANDOVER.md`](HANDOVER.md) — documento de repasse
- [`CHECKPOINT.md`](CHECKPOINT.md) — estado atual e correções recentes

## 🚀 Deploy no Vercel + Neon
A plataforma `web/` foi migrada de persistência em JSON/memória para **PostgreSQL gerenciado (Neon)**, compatível com o modelo serverless do Vercel. Veja o guia completo em [`web/README-VERCEL.md`](web/README-VERCEL.md).

Resumo:
```bash
# 1. Crie o banco no Neon e copie a "Pooled connection string"
# 2. Localmente, migre os dados:
DATABASE_URL="postgresql://..." npm run migrate
# 3. No Vercel, importe o repo com Root Directory: web
#    e configure DATABASE_URL, SESSION_SECRET, CRON_SECRET, SITE_URL,
#    SESSION_MAX_AGE_DAYS (opcional) e FITNESS_WINDOW_SIZE (opcional)
# 4. Deploy! O vercel.json cuida do Express, estáticos e cron.
```

> 🔑 **URL correta para os usuários:** use a URL de produção (`https://lotofacil-platform.vercel.app`).
> Os links de preview (`*-git-main-*.vercel.app`) são protegidos pela Vercel Authentication e
> pedem login da Vercel (conta social) — isso é proteção da plataforma, não do app.
> O app em si usa login por e-mail/senha (sem Google).

## 🔧 Comandos Disponíveis (Web)
```bash
npm start        # inicia o servidor
npm run dev      # inicia com hot-reload (node --watch)
npm run migrate  # migra os dados JSON → Postgres
npm run vercel-build  # build para o Vercel
npm test         # suíte de testes (Vitest + Supertest)
npm run test:watch  # modo watch
npm run check    # checagem de sintaxe (node --check)
npm run lint     # ESLint (flat config)
npm run format   # Prettier
```

## 🤖 Motor de IA
- **`web/lib/genetic_engine.js`**: Motor genético usado pela plataforma web (carrega histórico e semente do Postgres).
  Treina contra os últimos `FITNESS_WINDOW_SIZE` concursos (default 300) — ajustável por env.
- **`api_jogos_ia/`**: Engine em Python (FastAPI) para treinamento e geração de jogos com parâmetros de aprendizado de máquina

### Cache progressivo de resultados
O cache em memória **não carrega tudo de uma vez no boot**:
1. **Boot rápido** — carrega só os 100 concursos mais recentes (primeira tela instantânea)
2. **Hidratação em background** — lotes de 500 até o histórico completo do Postgres; a IA é
   recarregada ao final para aprender com **todos** os concursos
3. **Reconciliação** — se um concurso antigo for inserido no meio da hidratação, o cache é
   realinhado (recarga completa ~711ms)
4. **Sincronização incremental** — no boot consulta a Caixa (fonte oficial) e salva só os
   concursos que faltam; no Vercel, o cron diário mantém o banco atualizado
5. **Fallback sob demanda** — concurso fora do cache busca no Postgres/APIs como na primeira vez

> No Vercel (serverless), o histórico completo é carregado de forma **síncrona** (~711ms) porque
> timers de background congelam após a resposta HTTP — a IA sempre aprende com todos os concursos.

## 📱 Telas do Aplicativo (Mobile)
1. **🏠 Home**: Saldo, últimos resultados, cards de jogos e geração com IA
2. **💰 Carteira**: Extrato, depósitos, saques e bolões ativos
3. **📊 Histórico**: Jogos gerados, simulador de resultados
4. **👤 Perfil**: Dados do usuário, configurações e resumo financeiro

## 🐛 Solução de Problemas
### Erro: "DATABASE_URL não definida"
```bash
cd web && cp .env.example .env   # e preencha a connection string do Neon/Postgres
```
### Login não persiste em dev local
- Adicione `COOKIE_SECURE=false` no `web/.env` (cookie seguro exige HTTPS, e o localhost usa HTTP)
### Erro: "Command not found: expo"
```bash
cd lotofacil-platform/loteria-ai-app && npm install
```
### Deploy no Vercel falha no bootstrap
- Confirme que `DATABASE_URL` está no ambiente do Vercel e que o banco está acessível (Neon exige SSL)

## 📄 Licença
Este projeto está sob licença **MIT**. Sinta-se livre para usar e modificar.

## 🤝 Contribuição
Contribuições são bem-vindas! Siga estes passos:
1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📞 Suporte
Para dúvidas ou problemas:
- Consulte [`HANDOVER.md`](HANDOVER.md) para o documento de repasse técnico
- Consulte [`CHECKPOINT.md`](CHECKPOINT.md) para o estado atual do projeto
- Abra uma issue no repositório

## 🔗 Links Úteis
- [Documentação Expo](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [Documentação Vercel](https://vercel.com/docs)
- [Neon (Postgres serverless)](https://neon.tech/docs)

---
**Desenvolvido com ❤️ usando Node.js, React Native e Python**
