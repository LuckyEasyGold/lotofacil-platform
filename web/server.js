require('dotenv').config();
// Também carrega .env.local (criado pelo `vercel env pull` / dev local).
// Em produção (Vercel) o arquivo não existe — `quiet` evita warning e
// `override` faz o .env.local ter prioridade sobre o .env.
require('dotenv').config({ path: '.env.local', override: true, quiet: true });

const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const db = require('./db');
const { asyncHandler } = require('./lib/http');
const { getSessionUser } = require('./lib/auth');
const { geneticEngine, ensureReady, getResultsCache } = require('./lib/context');
const { processSubscriptions } = require('./lib/subscriptions');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1); // Vercel / proxies (cookie secure)

// ==================== CONFIG ====================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== SESSION (persistente no Postgres) ====================
app.use(session({
  store: new PgSession({ pool: db.pool, tableName: 'session' }),
  // Sessão assinada com segredo do ambiente. Em produção (Vercel) o
  // SESSION_SECRET está configurado; em dev local sem env, gera um aleatório
  // por boot (sessões não persistem entre restarts — comportamento esperado).
  secret: process.env.SESSION_SECRET || (() => {
    console.warn('⚠️ SESSION_SECRET não definida — usando segredo aleatório por boot (sessões reiniciam a cada restart). Configure no .env em produção.');
    return crypto.randomBytes(32).toString('hex');
  })(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    // Cookie seguro exige HTTPS. Em produção (Vercel) ativa por padrão;
    // em dev local usa COOKIE_SECURE=true só se configurado; na suíte de
    // testes (NODE_ENV=test) fica SEMPRE desativado (supertest usa HTTP).
    // Obs.: NODE_ENV é a primeira condição porque NÃO vem do .env.local
    // (que tem override:true e poderia reativar COOKIE_SECURE no teste).
    secure: process.env.NODE_ENV !== 'test' && (process.env.COOKIE_SECURE === 'true' || process.env.VERCEL === '1'),
    // Sessão longa: quem já logou antes entra direto (sem novo login).
    // Configurável via SESSION_MAX_AGE_DAYS (default 30 dias).
    maxAge: (parseInt(process.env.SESSION_MAX_AGE_DAYS || '30', 10) || 30) * 24 * 60 * 60 * 1000
  }
}));

// ==================== ROTAS POR DOMÍNIO (routes/*.js) ====================
// A refatoração dividiu o antigo server.js monolítico em routers por domínio.
// Cada router é montado aqui, na ordem em que deve ser avaliado.
app.use(require('./routes/auth'));          // /login, /register, /api/auth/*
app.use(require('./routes/pages'));         // páginas (dashboard, apostas, etc.)
app.use(require('./routes/admin'));         // /evolucao + /api/ai/evolution-history, /api/ai/evolve
app.use(require('./routes/ai'));            // /api/simulate, /api/ai/generate, /api/ai/seed
app.use(require('./routes/dashboard'));     // /api/dashboard, lucky-numbers, portfolio-insights
app.use(require('./routes/bets'));          // /api/bets
app.use(require('./routes/games'));         // /api/games (portfólio)
app.use(require('./routes/wallet'));        // /api/wallet
app.use(require('./routes/pools'));         // /api/pools + mercado de cotas
app.use(require('./routes/results'));       // /api/results + /api/database/stats
app.use(require('./routes/notifications')); // /api/notifications
app.use(require('./routes/subscriptions')); // /api/subscriptions + cron
app.use(require('./routes/gamification'));  // /api/gamification
app.use(require('./routes/share'));         // /api/share
app.use(require('./routes/stats'));         // /api/stats/advanced
app.use(require('./routes/profile'));       // /api/profile

// ==================== ERROR HANDLING ====================

app.use(asyncHandler(async (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Rota não encontrada' });
  }
  const user = await getSessionUser(req);
  res.status(404).render('dashboard', {
    title: '404 - Página não encontrada', page: 'dashboard', user
  });
}));

app.use((err, req, res, _next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ==================== START SERVER / EXPORT ====================

async function startServer() {
  try {
    await ensureReady();
    console.log('');
    console.log('============================================');
    console.log('    🎲 LOTOFÁCIL PLATFORM - SERVIDOR');
    console.log('============================================');
    console.log(`  Banco:    ${db.isNeon ? '🟢 Neon (Postgres serverless)' : '🟢 Postgres'}`);
    console.log(`  Cache:    ${getResultsCache().length} concursos`);
    console.log(`  Semente:  geração ${geneticEngine.currentGeneration} · fitness ${geneticEngine.bestFitness.toFixed(4)}`);
    console.log('  Auth:     🟢 Session-based (Postgres store)');
    console.log('  Fontes:   🥇 Guidi → 🥈 API Loterias → 🥉 Caixa');
    console.log('  Status:   🟢 Online');
    console.log('============================================');
    console.log('');
  } catch (e) {
    console.error('❌ Falha ao iniciar:', e.message);
  }
}

// No Vercel, o runtime serverless chama o Express exportado.
// Localmente (node server.js), inicia o servidor HTTP.
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    startServer();
    // Ciclo de assinaturas local (no Vercel usa cron)
    setInterval(() => processSubscriptions().catch(e => console.error('Erro no ciclo:', e.message)), 60 * 1000);
    console.log(`  Local:    http://localhost:${PORT}`);
  });
}

module.exports = app;
