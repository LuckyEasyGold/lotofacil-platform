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
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=lotofacil \
  -p 5432:5432 postgres:15-alpine
```
### Passo 2: Configure o ambiente
```bash
cd web
npm install
cp .env.example .env   # preencha DATABASE_URL, SESSION_SECRET, CRON_SECRET, SITE_URL
```
### Passo 3: Migre os dados (importa os JSONs locais para o Postgres)
```bash
npm run migrate
```
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
│   ├── server.js               # Servidor principal (Express serverless para Vercel)
│   ├── db.js                   # Camada de persistência PostgreSQL (Neon)
│   ├── lib/genetic_engine.js   # Motor genético (IA)
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

## 🚀 Deploy no Vercel + Neon
A plataforma `web/` foi migrada de persistência em JSON/memória para **PostgreSQL gerenciado (Neon)**, compatível com o modelo serverless do Vercel. Veja o guia completo em [`web/README-VERCEL.md`](web/README-VERCEL.md).

Resumo:
```bash
# 1. Crie o banco no Neon e copie a "Pooled connection string"
# 2. Localmente, migre os dados:
DATABASE_URL="postgresql://..." npm run migrate
# 3. No Vercel, importe o repo com Root Directory: web
#    e configure DATABASE_URL, SESSION_SECRET, CRON_SECRET, SITE_URL
# 4. Deploy! O vercel.json cuida do Express, estáticos e cron.
```

## 🔧 Comandos Disponíveis (Web)
```bash
npm start        # inicia o servidor
npm run dev      # inicia com hot-reload (node --watch)
npm run migrate  # migra os dados JSON → Postgres
npm run vercel-build  # build para o Vercel
```

## 🤖 Motor de IA
- **`web/lib/genetic_engine.js`**: Motor genético usado pela plataforma web (carrega histórico e semente do Postgres)
- **`api_jogos_ia/`**: Engine em Python (FastAPI) para treinamento e geração de jogos com parâmetros de aprendizado de máquina

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
