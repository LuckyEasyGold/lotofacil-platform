require('dotenv').config();
// Também carrega .env.local (criado pelo `vercel env pull` / dev local).
// Em produção (Vercel) o arquivo não existe — `quiet` evita warning e
// `override` faz o .env.local ter prioridade sobre o .env.
require('dotenv').config({ path: '.env.local', override: true, quiet: true });

const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const LotteryGeneticEngine = require('./lib/genetic_engine');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== CACHE PROGRESSIVO ====================
// O cache começa só com os concursos mais recentes (boot rápido no serverless)
// e é hidratado em background até conter o histórico completo do Postgres.
const INITIAL_CACHE_SIZE = 100;   // concursos carregados no boot (primeira tela)
const HYDRATE_BATCH_SIZE = 500;   // tamanho de cada lote da hidratação em background

// ==================== ASYNC WRAPPER ====================
// Express 4 não captura rejeições de handlers async. Este monkey-patch envolve
// TODAS as rotas registradas, encaminhando erros ao middleware de erro e
// evitando unhandled rejections (que derrubariam o processo no Node 15+).
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

['get', 'post', 'put', 'delete'].forEach(method => {
  const original = app[method].bind(app);
  app[method] = (path, ...handlers) =>
    original(path, ...handlers.map(h => h.length >= 4 ? h : asyncHandler(h)));
});

app.set('trust proxy', 1); // Vercel / proxies (cookie secure)

// ==================== LOCAL AI ENGINE (backed por Postgres) ====================
// O motor carrega histórico e semente do banco, e salva a semente no banco.
let resultsCache = [];       // cache por instância; a fonte da verdade é o Postgres
let currentSeed = null;

const geneticEngine = new LotteryGeneticEngine('LOTOFACIL', {
  autoEvolve: false, // não queimar CPU em cold starts do serverless
  historicalResultsProvider: () => resultsCache,
  seedProvider: () => currentSeed,
  seedSaver: (data) => {
    currentSeed = data;
    db.saveSeed('LOTOFACIL', data).catch(e => console.error('Erro ao salvar semente:', e.message));
  }
});

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
  secret: process.env.SESSION_SECRET || 'lotofacil-platform-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.VERCEL === '1' || process.env.COOKIE_SECURE === 'true',
    // Sessão longa: quem já logou antes entra direto (sem novo login).
    // Configurável via SESSION_MAX_AGE_DAYS (default 30 dias).
    maxAge: (parseInt(process.env.SESSION_MAX_AGE_DAYS || '30', 10) || 30) * 24 * 60 * 60 * 1000
  }
}));

// ==================== LOTERIA CONFIGS ====================
const LOTTERY_CONFIGS = {
  LOTOFACIL: { name: 'Lotofácil', totalNumbers: 25, pickCount: 15, price: 3.00 },
  MEGASENA: { name: 'Mega-Sena', totalNumbers: 60, pickCount: 6, price: 5.00 },
  QUINA: { name: 'Quina', totalNumbers: 80, pickCount: 5, price: 2.50 },
  LOTOMANIA: { name: 'Lotomania', totalNumbers: 100, pickCount: 20, price: 3.00 }
};

const PRIZE_TABLES = {
  LOTOFACIL: { 11: 6, 12: 12, 13: 30, 14: 1124.87, 15: 924479.40 },
  MEGASENA: { 4: 12.50, 5: 1578.90, 6: 12500000.00 },
  QUINA: { 3: 5.80, 4: 125.60, 5: 1520000.00 },
  LOTOMANIA: { 16: 6.00, 17: 12.00, 18: 54.00, 19: 845.60, 20: 1250000.00 }
};

// ==================== BOOTSTRAP (async) ====================
// Cria as tabelas, semeia os bolões iniciais, carrega cache de resultados
// e a semente da IA. As rotas aguardam `ready` antes de ler o cache.
async function bootstrap() {
  await db.ensureSchema();

  // Bolões iniciais (se a tabela estiver vazia)
  const pools = await db.getPools();
  if (pools.length === 0) {
    await db.createPool({
      id: '1', name: 'Bolão da Sorte', gameType: 'LOTOFACIL', contestNumber: 3005,
      totalShares: 100, availableShares: 45, sharePrice: 25.00, minShares: 1, maxShares: 20,
      numbers: [1,2,5,6,9,10,11,12,15,17,18,19,21,24,25],
      creatorName: 'Maria', status: 'open', createdAt: new Date(),
      participants: [{ name: 'Maria', shares: 10, paid: true }, { name: 'João', shares: 5, paid: true }]
    });
    await db.createPool({
      id: '2', name: 'Mega Bolão LF', gameType: 'LOTOFACIL', contestNumber: 3006,
      totalShares: 50, availableShares: 20, sharePrice: 50.00, minShares: 1, maxShares: 10,
      numbers: [3,4,7,8,13,14,16,20,22,23,1,5,9,11,25],
      creatorName: 'Carlos', status: 'open', createdAt: new Date(),
      participants: [{ name: 'Carlos', shares: 15, paid: true }]
    });
    console.log('👥 Bolões iniciais criados');
  }

  // Cache de resultados (fonte: Postgres) — carregamento PROGRESSIVO:
  // 1) o boot traz só os mais recentes (primeira tela rápida);
  // 2) a hidratação em background preenche o resto em lotes;
  // 3) a sincronização incremental busca nas APIs os concursos que faltam.
  // No Vercel (serverless), timers de background congelam após a resposta HTTP —
  // então carrega o histórico completo de forma SÍNCRONA (medido: ~711ms, bem
  // abaixo do limite de duração) para a IA aprender com TODOS os concursos.
  // Em dev local, carrega só os mais recentes (boot rápido) e hidrata em
  // background — por isso o load inicial de 100 fica só nesse caminho.
  if (process.env.VERCEL === '1') {
    resultsCache = await db.getResults();
    console.log(`✅ Vercel: histórico completo carregado (${resultsCache.length} concursos)`);
  } else {
    resultsCache = await db.getRecentResults(INITIAL_CACHE_SIZE);
    console.log(`📦 Cache inicial: ${resultsCache.length} concursos (mais recentes)`);
    hydrateCacheInBackground();
    syncMissingResults();
  }

  // Semente da IA
  currentSeed = await db.getSeed('LOTOFACIL');
  geneticEngine.loadHistoricalResults();
  geneticEngine.loadSavedSeed();
}

const ready = bootstrap().catch(e => console.error('❌ Erro no bootstrap:', e.message));

async function ensureReady() {
  await ready;
}

// ==================== AUTH HELPERS ====================

/** Get the currently logged-in user from session (via Postgres) */
async function getSessionUser(req) {
  if (!req.session.userId) return null;
  try {
    return await db.getUserById(req.session.userId);
  } catch (e) {
    return null;
  }
}

/** Require authentication middleware — redirects to /login if not logged in */
async function requireAuth(req, res, next) {
  try {
    const user = await getSessionUser(req);
    if (user) {
      req.currentUser = user;
      return next();
    }
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    return res.redirect('/login');
  } catch (e) {
    return next(e);
  }
}

/** Require admin role middleware — must be used AFTER requireAuth */
function requireAdmin(req, res, next) {
  if (req.currentUser && req.currentUser.role === 'admin') {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(403).json({ error: 'Acesso negado - necessário perfil admin' });
  }
  res.status(403).render('dashboard', {
    title: 'Acesso negado', page: 'dashboard', user: req.currentUser || null,
    subtitle: 'Você não tem permissão para acessar esta página'
  });
}

function sanitizeUser(user) {
  return {
    id: user.id, name: user.name, email: user.email,
    avatar: user.avatar, balance: user.balance,
    bonusBalance: user.bonusBalance, totalWinnings: user.totalWinnings,
    role: user.role
  };
}

// ==================== NOTIFICAÇÕES ====================

async function addNotification(userId, type, title, message, link = null) {
  await db.addNotification({
    id: uuidv4(), userId, type, title, message, link,
    read: false, createdAt: new Date().toISOString()
  });
}

// ==================== AUTH ROUTES ====================

/** GET /login — Página de login */
app.get('/login', async (req, res) => {
  const user = await getSessionUser(req);
  if (user) return res.redirect('/');
  res.render('login');
});

/** GET /register — Página de cadastro */
app.get('/register', async (req, res) => {
  const user = await getSessionUser(req);
  if (user) return res.redirect('/');
  res.render('register');
});

/** POST /api/auth/register — Criar nova conta */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Preencha todos os campos' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Senha deve ter no mínimo 6 caracteres' });
    }
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Este e-mail já está cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: uuidv4(),
      name,
      email,
      password: hashedPassword,
      avatar: name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(),
      balance: 0,
      bonusBalance: 50.00, // bônus de boas-vindas
      totalWinnings: 0,
      role: 'user',
      createdAt: new Date().toISOString()
    };

    await db.createUser(newUser);

    req.session.userId = newUser.id;
    res.json({ success: true, user: sanitizeUser(newUser), redirect: '/' });
  } catch (e) {
    console.error('Erro no registro:', e.message);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

/** POST /api/auth/login — Fazer login */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Preencha e-mail e senha' });
    }

    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, error: 'E-mail ou senha incorretos' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'E-mail ou senha incorretos' });
    }

    req.session.userId = user.id;
    res.json({ success: true, user: sanitizeUser(user), redirect: '/' });
  } catch (e) {
    console.error('Erro no login:', e.message);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

/** POST /api/auth/logout — Sair */
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Erro ao sair' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

/** GET /api/auth/me — Dados do usuário logado */
app.get('/api/auth/me', async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: sanitizeUser(user) });
});

// ==================== CACHE DE RESULTADOS (backed por Postgres) ====================

async function saveToDatabase(contest) {
  if (!contest || !contest.numero) return;
  await db.saveResult(contest);
  const exists = resultsCache.find(c => c.numero === contest.numero);
  if (!exists) {
    resultsCache.push(contest);
    resultsCache.sort((a, b) => a.numero - b.numero);
  }
}

async function findInDatabase(contestNumber) {
  await ensureReady();
  const cached = resultsCache.find(c => c.numero === contestNumber);
  if (cached) return cached;
  // Concurso fora da janela do cache: busca sob demanda no Postgres
  const fromDb = await db.getResultByNumero(contestNumber);
  if (fromDb && !resultsCache.find(c => c.numero === fromDb.numero)) {
    resultsCache.push(fromDb);
    resultsCache.sort((a, b) => a.numero - b.numero);
  }
  return fromDb;
}

async function getLatestFromDatabase() {
  await ensureReady();
  return resultsCache.length > 0 ? resultsCache[resultsCache.length - 1] : null;
}

async function getRecentContests(limit = 10) {
  await ensureReady();
  if (resultsCache.length === 0) return [];
  return resultsCache.slice(-limit).reverse();
}

async function getDatabaseStats() {
  await ensureReady();
  // Total/primeiro/último consultados no Postgres (o cache agora tem só os últimos 500)
  const { rows } = await db.pool.query(
    'SELECT COUNT(*)::int AS total, MIN(numero)::int AS first, MAX(numero)::int AS last FROM results'
  );
  const s = rows[0] || { total: 0, first: null, last: null };
  let lastDate = null;
  if (s.last) {
    const latest = resultsCache.find(c => c.numero === s.last) || (await db.getResultByNumero(s.last));
    if (latest) lastDate = latest.dataApuracao;
  }
  return { total: s.total || 0, first: s.first, last: s.last, lastDate };
}

// ==================== API LOTERIAS (3 FONTES EM CASCATA) ====================
const API_GUIDI = 'https://api.guidi.dev.br/loteria/lotofacil';
const API_LOTERIAS_BASE = 'https://raw.githubusercontent.com/maickon/free-apiloterias/refs/heads/master/database/lotofacil';
const CAIXA_API_BASE = 'https://servicebus2.caixa.gov.br/portaldeloterias/api';

// Tenta APIs externas em background com timeouts curtos
// Retorna o resultado do cache local instantaneamente
async function tryFetchFromExternalAPIs() {
  let result = null;
  try {
    const resp = await axios.get(`${API_GUIDI}/ultimo`, { timeout: 4000 });
    if (resp.data && resp.data.listaDezenas) result = resp.data;
  } catch (e) {}
  if (!result) {
    try {
      const resp = await axios.get(`${API_LOTERIAS_BASE}/_ultimo.json`, { timeout: 4000 });
      if (resp.data && resp.data.listaDezenas) result = resp.data;
    } catch (e) {}
  }
  if (!result) {
    try {
      const resp = await axios.get(`${CAIXA_API_BASE}/lotofacil/latest`, { timeout: 3000, headers: { 'Accept': 'application/json' } });
      if (resp.data && resp.data.listaDezenas) result = resp.data;
    } catch (e) {}
  }
  return result;
}

/** Último resultado: PRIORIDADE MÁXIMA ao cache local, APIs em background */
async function fetchLatestLotofacilResult() {
  const cached = await getLatestFromDatabase();

  tryFetchFromExternalAPIs().then(apiResult => {
    if (apiResult && apiResult.numero) {
      const exists = resultsCache.find(c => c.numero === apiResult.numero);
      if (!exists) {
        saveToDatabase(apiResult).then(() => {
          console.log(`📥 Novo concurso cacheado via API: #${apiResult.numero}`);
        }).catch(() => {});
      } else if (cached && apiResult.numero > cached.numero) {
        saveToDatabase(apiResult).then(() => {
          console.log(`📥 Concurso #${apiResult.numero} adicionado ao cache`);
        }).catch(() => {});
      }
    }
  }).catch(() => {});

  return cached;
}

async function fetchLotofacilResultsByContest(contestNumber) {
  const cached = await findInDatabase(contestNumber);
  if (cached) return cached;

  try {
    const resp = await axios.get(`${API_GUIDI}/${contestNumber}`, { timeout: 4000 });
    if (resp.data && resp.data.listaDezenas) { await saveToDatabase(resp.data); return resp.data; }
  } catch (e) {}
  try {
    const resp = await axios.get(`${API_LOTERIAS_BASE}/${contestNumber}.json`, { timeout: 4000 });
    if (resp.data && resp.data.listaDezenas) { await saveToDatabase(resp.data); return resp.data; }
  } catch (e) {}
  try {
    const resp = await axios.get(`${CAIXA_API_BASE}/lotofacil/${contestNumber}`, { timeout: 3000, headers: { 'Accept': 'application/json' } });
    if (resp.data && resp.data.listaDezenas) { await saveToDatabase(resp.data); return resp.data; }
  } catch (e) {}
  return null;
}

// ==================== CACHE PROGRESSIVO: HIDRATAÇÃO ====================
// Preenche o resultsCache em lotes até conter o histórico completo do Postgres.
// Roda em background (com pausas) para não bloquear requisições durante o boot.
async function hydrateCacheInBackground() {
  try {
    const cacheTotal = await db.getResultsCount();
    while (true) {
      // Pausa leve entre lotes: deixa o event loop atender as requisições
      await new Promise(r => setTimeout(r, 60));
      const next = await db.getResultsWindow(HYDRATE_BATCH_SIZE, resultsCache.length);
      if (!next || next.length === 0) break;
      const known = new Set(resultsCache.map(c => c.numero));
      const fresh = next.filter(c => !known.has(c.numero));
      resultsCache = resultsCache.concat(fresh);
      resultsCache.sort((a, b) => a.numero - b.numero);
      console.log(`📦 Cache: ${resultsCache.length}/${cacheTotal} concursos hidratados`);
    }
    // Reconciliação final (sempre): se um concurso antigo foi inserido no meio
    // da hidratação (ex.: /api/results/500 logo após o boot), o offset por
    // `length` pode ter pulado um trecho sem alterar o total — a checagem por
    // contagem não detectaria. Recarrega tudo do Postgres (medido: ~711ms)
    // para garantir que cache e IA fiquem 100% completos.
    resultsCache = await db.getResults();
    console.log(`🔁 Reconciliação final: ${resultsCache.length} concursos no cache`);
    // Com o histórico completo, recarrega o motor da IA (aprende com TUDO)
    geneticEngine.loadHistoricalResults();
    console.log(`✅ Cache 100% hidratado (${resultsCache.length} concursos) — IA com histórico completo`);
  } catch (e) {
    // Falha na hidratação não derruba o servidor: o findInDatabase cobre
    // qualquer número fora do cache (busca no Postgres e depois nas APIs).
    console.error('⚠️ Hidratação em background interrompida:', e.message);
  }
}

// ==================== SINC. INCREMENTAL (ATUALIZAÇÃO) ====================
// Verifica qual é o último concurso nas APIs externas (prioriza a Caixa, fonte
// oficial) e salva os concursos que faltam no banco + cache. Roda em background
// no boot: depois disso, cada boot só baixa a atualização.
async function syncMissingResults() {
  try {
    await ensureReady();
    const dbLatest = await db.getLatestResult();
    const dbNum = dbLatest ? parseInt(dbLatest.numero, 10) : 0;

    // Busca o "último" oficial — Caixa primeiro (fonte da verdade), depois cascata
    let apiLatest = null;
    try {
      const resp = await axios.get(`${CAIXA_API_BASE}/lotofacil/latest`, {
        timeout: 4000, headers: { 'Accept': 'application/json' }
      });
      if (resp.data && resp.data.numero && resp.data.listaDezenas) apiLatest = resp.data;
    } catch (e) {}
    if (!apiLatest) apiLatest = await tryFetchFromExternalAPIs();
    if (!apiLatest || !apiLatest.numero) return;

    const apiNum = parseInt(apiLatest.numero, 10);
    if (apiNum <= dbNum) {
      console.log(`📥 Banco já atualizado (último: #${dbNum})`);
      return;
    }

    const missing = Math.min(apiNum - dbNum, 30); // limite de segurança por execução
    console.log(`📥 Sincronizando ${missing} concurso(s) faltante(s) (#${dbNum + 1} → #${apiNum})...`);
    for (let n = dbNum + 1; n <= dbNum + missing; n++) {
      const c = await fetchLotofacilResultsByContest(n);
      if (!c || !c.listaDezenas) {
        console.log(`   #${n} indisponível nas APIs — sincronização interrompida`);
        break;
      }
      await saveToDatabase(c);
      console.log(`   ✅ #${n} sincronizado (${c.dataApuracao || '?'})`);
    }
    console.log('📥 Sincronização concluída');
  } catch (e) {
    console.error('⚠️ Erro na sincronização incremental:', e.message);
  }
}

// ==================== AI ENGINE INTEGRATION ====================

let simulationCache = {};

function generateMockAIGames(quantity) {
  const games = [];
  for (let i = 0; i < quantity; i++) {
    const numbers = new Set();
    while (numbers.size < 15) numbers.add(Math.floor(Math.random() * 25) + 1);
    games.push(Array.from(numbers).sort((a, b) => a - b));
  }
  return { game_type: 'LOTOFACIL', seed_version: '1.0.mock', games, generated_at: new Date().toISOString() };
}

function simulateAI(numbers) {
  const simKey = numbers.join(',');
  if (simulationCache[simKey]) return simulationCache[simKey];
  const numSet = new Set(numbers);
  const results = [];
  let totalHits = 0, bestHit = 0, totalPrize = 0;
  const prizes = { 11: 6, 12: 12, 13: 30, 14: 1124.87, 15: 924479.40 };
  for (let i = 0; i < 50; i++) {
    const drawn = new Set();
    while (drawn.size < 15) drawn.add(Math.floor(Math.random() * 25) + 1);
    const hits = [...numSet].filter(n => drawn.has(n)).length;
    const prize = hits >= 11 ? (prizes[hits] || 0) : 0;
    results.push({ contestNumber: 3000 - i, drawnNumbers: [...drawn].sort((a, b) => a - b), hits, prize });
    if (hits > bestHit) bestHit = hits;
    if (hits >= 11) { totalHits++; totalPrize += prize; }
  }
  const sim = { numbers, totalHits, bestHit, totalPrize, results, gamesPlayed: 50, hitRate: ((totalHits / 50) * 100).toFixed(1) };
  simulationCache[simKey] = sim;
  return sim;
}

// ==================== ROUTES (PÁGINAS) ====================

// Todas as páginas protegidas por autenticação
app.get('/', requireAuth, (req, res) => {
  res.render('dashboard', { title: 'Dashboard', page: 'dashboard', user: req.currentUser });
});

app.get('/apostas', requireAuth, (req, res) => {
  res.render('bets', { title: 'Apostas', page: 'bets', user: req.currentUser, subtitle: 'Escolha seus números da sorte' });
});

app.get('/carteira', requireAuth, (req, res) => {
  res.render('wallet', { title: 'Carteira', page: 'wallet', user: req.currentUser, subtitle: 'Gerencie seu saldo e transações' });
});

app.get('/boloes', requireAuth, (req, res) => {
  res.render('pools', { title: 'Bolões', page: 'pools', user: req.currentUser, subtitle: 'Crie ou participe de bolões' });
});

app.get('/simulacao', requireAuth, (req, res) => {
  res.render('simulation', { title: 'Simulação com IA', page: 'simulation', user: req.currentUser, subtitle: 'Use inteligência artificial para analisar seus jogos' });
});

app.get('/resultados', requireAuth, (req, res) => {
  res.render('results', { title: 'Resultados', page: 'results', user: req.currentUser, subtitle: 'Resultados oficiais da Lotofácil' });
});

app.get('/perfil', requireAuth, (req, res) => {
  res.render('profile', { title: 'Perfil', page: 'profile', user: req.currentUser, subtitle: 'Suas informações pessoais' });
});

app.get('/meus-jogos', requireAuth, (req, res) => {
  res.render('my-games', { title: 'Meus Jogos', page: 'my-games', user: req.currentUser, subtitle: 'Gerencie seu portfólio de jogos' });
});

app.get('/configuracoes', requireAuth, (req, res) => {
  res.render('settings', { title: 'Configurações', page: 'settings', user: req.currentUser, subtitle: 'Personalize sua experiência' });
});

// ==================== ROTAS ADMIN — EVOLUÇÃO DA IA ====================
// (Somente admin pode ver)
app.get('/evolucao', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureReady();
    const evo = geneticEngine.getEvolutionHistory();
    res.render('evolution', {
      title: 'Evolução da IA', page: 'evolution', user: req.currentUser,
      subtitle: '🧬 Geração ' + evo.currentGeneration + ' · Fitness ' + evo.bestFitness.toFixed(2),
      evolution: evo
    });
  } catch (e) {
    console.error('❌ Erro ao renderizar evolution:', e);
    res.status(500).json({ error: 'Erro interno do servidor: ' + e.message });
  }
});

app.get('/api/ai/evolution-history', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureReady();
    res.json(geneticEngine.getEvolutionHistory());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ai/evolve', requireAuth, requireAdmin, async (req, res) => {
  const generations = parseInt(req.body.generations) || 10;
  if (generations < 1 || generations > 100) {
    return res.status(400).json({ error: 'Gerações deve ser entre 1 e 100' });
  }
  try {
    await ensureReady();
    const result = await geneticEngine.evolveMore(generations);
    res.json({ success: true, evolution: result });
  } catch (e) {
    if (e.message === 'Evolução já em andamento') {
      res.status(409).json({ error: 'Já existe uma evolução em andamento', evolving: true });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

app.get('/api/ai/evolve/status', requireAuth, requireAdmin, (req, res) => {
  res.json({ evolving: geneticEngine.isEvolving() });
});

// ==================== API ROUTES ====================

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    await ensureReady();
    const latestResult = await fetchLatestLotofacilResult();
    const stats = await getDatabaseStats();
    const userTransactions = await db.getUserTransactions(req.currentUser.id, 5);
    const userBets = await db.getUserBets(req.currentUser.id);
    const pools = await db.getPools();
    res.json({
      user: sanitizeUser(req.currentUser),
      latestResult,
      transactions: userTransactions,
      activePools: pools.filter(p => p.status === 'open').length,
      activeBets: userBets.length,
      dbStats: stats
    });
  } catch (error) {
    console.error('Erro no dashboard:', error.message);
    const userTransactions = await db.getUserTransactions(req.currentUser.id, 5).catch(() => []);
    const userBets = await db.getUserBets(req.currentUser.id).catch(() => []);
    const pools = await db.getPools().catch(() => []);
    res.json({
      user: sanitizeUser(req.currentUser), latestResult: null,
      transactions: userTransactions,
      activePools: pools.length, activeBets: userBets.length
    });
  }
});

// ==================== BETS ====================

app.post('/api/bets', requireAuth, async (req, res) => {
  try {
    const { gameType, numbers, amount } = req.body;
    const user = req.currentUser;
    const bet = { id: uuidv4(), gameType, numbers, amount, date: new Date(), status: 'active', userId: user.id };
    await db.addBet(bet);
    await db.adjustUserBalance(user.id, -amount);
    await db.addTransaction({
      id: uuidv4(), userId: user.id, type: 'bet', amount: -amount,
      description: `Aposta Lotofácil - ${numbers.length} números`,
      date: new Date(), status: 'completed'
    });
    res.json({ success: true, bet });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/bets', requireAuth, async (req, res) => {
  const userBets = await db.getUserBets(req.currentUser.id);
  res.json(userBets);
});

/** GET /api/bets/my — Retorna apostas do usuário logado (alias) */
app.get('/api/bets/my', requireAuth, async (req, res) => {
  const userBets = await db.getUserBets(req.currentUser.id);
  res.json(userBets);
});

// ==================== API GAMES PORTFOLIO ====================

/** POST /api/games — Salvar um jogo no portfólio */
app.post('/api/games', requireAuth, async (req, res) => {
  try {
    const user = req.currentUser;
    const { numbers, gameType, name, source, seedVersion } = req.body;
    const gType = gameType || 'LOTOFACIL';
    const cfg = LOTTERY_CONFIGS[gType];
    if (!cfg) return res.status(400).json({ error: 'Tipo de jogo inválido' });
    if (!numbers || numbers.length !== cfg.pickCount) {
      return res.status(400).json({ error: 'É necessário exatamente ' + cfg.pickCount + ' números para ' + cfg.name });
    }
    const sorted = [...numbers].sort((a, b) => a - b);
    if (sorted[0] < 1 || sorted[sorted.length - 1] > cfg.totalNumbers) {
      return res.status(400).json({ error: 'Números devem estar entre 1 e ' + cfg.totalNumbers });
    }
    if (new Set(sorted).size !== cfg.pickCount) {
      return res.status(400).json({ error: 'Números não podem se repetir' });
    }
    const userGames = await db.getUserGames(user.id);
    const game = {
      id: uuidv4(),
      userId: user.id,
      numbers: numbers.sort((a, b) => a - b),
      gameType: gameType || 'LOTOFACIL',
      name: name || `Jogo #${userGames.length + 1}`,
      source: source || 'manual',
      seedVersion: seedVersion || null,
      createdAt: new Date().toISOString(),
      status: 'active',
      usageHistory: [],
      poolId: null
    };
    await db.createGame(game);
    await checkAchievements(user.id);
    res.json({ success: true, game });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/games — Listar jogos do usuário (com filtros) */
app.get('/api/games', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const { status, source, gameType } = req.query;
  let games = await db.getUserGames(user.id);
  if (status) games = games.filter(g => g.status === status);
  if (source) games = games.filter(g => g.source === source);
  if (gameType) games = games.filter(g => g.gameType === gameType);
  games.sort((a, b) => {
    const order = { active: 0, used: 1, won: 2, archived: 3 };
    const diff = (order[a.status] || 0) - (order[b.status] || 0);
    if (diff !== 0) return diff;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  res.json({ games, total: games.length });
});

/** GET /api/games/stats — Estatísticas do portfólio */
app.get('/api/games/stats', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const userGs = await db.getUserGames(user.id);
  res.json({
    total: userGs.length,
    active: userGs.filter(g => g.status === 'active').length,
    used: userGs.filter(g => g.status === 'used').length,
    won: userGs.filter(g => g.status === 'won').length,
    archived: userGs.filter(g => g.status === 'archived').length,
    totalUsed: userGs.reduce((sum, g) => sum + g.usageHistory.length, 0),
    totalHits: userGs.reduce((sum, g) => sum + g.usageHistory.reduce((s, u) => s + (u.hits || 0), 0), 0)
  });
});

/** PUT /api/games/:id — Atualizar jogo (nome, status) */
app.put('/api/games/:id', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const game = await db.getGameById(req.params.id, user.id);
  if (!game) return res.status(404).json({ error: 'Jogo não encontrado' });
  const { name, status } = req.body;
  const fields = {};
  if (name) fields.name = name;
  if (status && ['active', 'used', 'archived', 'won'].includes(status)) {
    fields.status = status;
  }
  await db.updateGame(req.params.id, fields);
  res.json({ success: true, game: await db.getGameById(req.params.id, user.id) });
});

/** DELETE /api/games/:id — Arquivar (ou excluir permanentemente) */
app.delete('/api/games/:id', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const game = await db.getGameById(req.params.id, user.id);
  if (!game) return res.status(404).json({ error: 'Jogo não encontrado' });
  if (game.usageHistory.length === 0) {
    await db.deleteGame(req.params.id);
  } else {
    await db.updateGame(req.params.id, { status: 'archived' });
  }
  res.json({ success: true });
});

/** POST /api/games/:id/use — Marcar jogo como usado em concurso */
app.post('/api/games/:id/use', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const { contestNumber } = req.body;
  const game = await db.getGameById(req.params.id, user.id);
  if (!game) return res.status(404).json({ error: 'Jogo não encontrado' });
  game.usageHistory.push({
    contestNumber: contestNumber || null,
    date: new Date().toISOString(),
    hits: null,
    prize: null,
    matched: false
  });
  game.status = 'used';
  await db.updateGame(req.params.id, { status: 'used', usageHistory: game.usageHistory });
  res.json({ success: true, game });
});

/** POST /api/games/:id/check-result — Verificar se o jogo acertou no último resultado */
app.post('/api/games/:id/check-result', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const game = await db.getGameById(req.params.id, user.id);
  if (!game) return res.status(404).json({ error: 'Jogo não encontrado' });
  try {
    const latest = await fetchLatestLotofacilResult();
    if (!latest || !latest.listaDezenas) {
      return res.status(400).json({ error: 'Não foi possível obter resultado' });
    }
    const drawnNumbers = latest.listaDezenas.map(n => parseInt(n));
    const drawnSet = new Set(drawnNumbers);
    const hits = game.numbers.filter(n => drawnSet.has(n)).length;
    const prizes = { 11: 6, 12: 12, 13: 30, 14: 1124.87, 15: 924479.40 };
    const prize = hits >= 11 ? (prizes[hits] || 0) : 0;
    const lastUsage = game.usageHistory[game.usageHistory.length - 1];
    if (lastUsage) {
      lastUsage.hits = hits;
      lastUsage.prize = prize;
      lastUsage.matched = hits >= 11;
      lastUsage.contestNumber = latest.numero;
    }
    if (hits >= 11) {
      game.status = 'won';
      await checkAchievements(user.id);
      if (prize > 0) {
        await db.adjustUserBalance(user.id, prize);
        await db.adjustUserWinnings(user.id, prize);
        await db.addTransaction({
          id: uuidv4(), userId: user.id, type: 'prize', amount: prize,
          description: `🏆 Prêmio de ${hits} acertos - Concurso ${latest.numero}`,
          date: new Date(), status: 'completed'
        });
        await addNotification(user.id, 'prize',
          '🏆 Jogo premiado!',
          `"${game.name}" fez ${hits} acertos no concurso ${latest.numero}! Prêmio: R$ ${prize.toFixed(2)}`,
          '/meus-jogos'
        );
      }
    }
    await db.updateGame(req.params.id, { status: game.status, usageHistory: game.usageHistory });
    res.json({ success: true, game, result: {
      contestNumber: latest.numero,
      drawnNumbers,
      hits,
      prize,
      isWinner: hits >= 11
    }});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/games/:id/create-pool — Criar bolão a partir de um jogo */
app.post('/api/games/:id/create-pool', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const game = await db.getGameById(req.params.id, user.id);
  if (!game) return res.status(404).json({ error: 'Jogo não encontrado' });
  const { name, totalShares, sharePrice } = req.body;
  const newPool = {
    id: uuidv4(),
    name: name || `Bolão ${game.name}`,
    gameType: game.gameType,
    contestNumber: parseInt(req.body.contestNumber) || 3005,
    totalShares: parseInt(totalShares) || 50,
    availableShares: parseInt(totalShares) - 1 || 49,
    sharePrice: parseFloat(sharePrice) || 25.00,
    minShares: 1,
    maxShares: Math.floor((parseInt(totalShares) || 50) * 0.2),
    numbers: game.numbers,
    creatorName: user.name,
    status: 'open',
    createdAt: new Date(),
    participants: [{ name: user.name, shares: 1, paid: true }]
  };
  await db.createPool(newPool);
  game.poolId = newPool.id;
  game.status = 'used';
  game.usageHistory.push({
    contestNumber: newPool.contestNumber,
    date: new Date().toISOString(),
    hits: null,
    prize: null,
    matched: false
  });
  await db.updateGame(game.id, { pool_id: newPool.id, status: 'used', usageHistory: game.usageHistory });
  await db.adjustUserBalance(user.id, -(parseFloat(sharePrice) || 25));
  await db.addTransaction({
    id: uuidv4(), userId: user.id, type: 'pool_join', amount: -(parseFloat(sharePrice) || 25),
    description: `Criação do bolão "${newPool.name}" - 1 cota`,
    date: new Date(), status: 'completed'
  });
  res.json({ success: true, pool: newPool });
});

/** POST /api/games/:id/duplicate — Duplicar jogo (reusar números) */
app.post('/api/games/:id/duplicate', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const orig = await db.getGameById(req.params.id, user.id);
  if (!orig) return res.status(404).json({ error: 'Jogo não encontrado' });
  const newGame = {
    id: uuidv4(),
    userId: user.id,
    numbers: [...orig.numbers],
    gameType: orig.gameType,
    name: `${orig.name} (cópia)`,
    source: orig.source,
    seedVersion: orig.seedVersion,
    createdAt: new Date().toISOString(),
    status: 'active',
    usageHistory: [],
    poolId: null
  };
  await db.createGame(newGame);
  res.json({ success: true, game: newGame });
});

// ==================== CARTEIRA ====================

app.get('/api/wallet', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const userTransactions = await db.getUserTransactions(user.id);
  res.json({
    balance: user.balance, bonusBalance: user.bonusBalance,
    totalWinnings: user.totalWinnings, transactions: userTransactions
  });
});

app.post('/api/wallet/deposit', requireAuth, async (req, res) => {
  const amount = parseFloat(req.body.amount);
  const method = req.body.method || 'PIX';
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valor inválido' });
  await db.adjustUserBalance(req.currentUser.id, amount);
  const txn = { id: uuidv4(), userId: req.currentUser.id, type: 'deposit', amount, description: `Depósito via ${method}`, date: new Date(), status: 'completed' };
  await db.addTransaction(txn);
  const user = await db.getUserById(req.currentUser.id);
  res.json({ success: true, transaction: txn, balance: user.balance });
});

app.post('/api/wallet/withdraw', requireAuth, async (req, res) => {
  const amount = parseFloat(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valor inválido' });
  const user = req.currentUser;
  if (amount > user.balance) return res.status(400).json({ error: 'Saldo insuficiente' });
  await db.adjustUserBalance(user.id, -amount);
  const txn = { id: uuidv4(), userId: user.id, type: 'withdrawal', amount: -amount, description: 'Saque para conta bancária', date: new Date(), status: 'pending' };
  await db.addTransaction(txn);
  const updated = await db.getUserById(user.id);
  res.json({ success: true, transaction: txn, balance: updated.balance });
});

// ==================== BOLÕES ====================

app.get('/api/pools', requireAuth, async (req, res) => {
  res.json(await db.getPools());
});

app.post('/api/pools', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const pool = req.body;
  const newPool = {
    id: uuidv4(), name: pool.name, gameType: pool.gameType,
    contestNumber: parseInt(pool.contestNumber),
    totalShares: parseInt(pool.totalShares),
    availableShares: parseInt(pool.totalShares) - 1,
    sharePrice: parseFloat(pool.sharePrice),
    minShares: 1, maxShares: Math.floor(parseInt(pool.totalShares) * 0.2),
    numbers: pool.numbers, creatorName: user.name,
    status: 'open', createdAt: new Date(),
    participants: [{ name: user.name, shares: 1, paid: true }]
  };
  await db.createPool(newPool);
  await db.adjustUserBalance(user.id, -parseFloat(pool.sharePrice));
  await db.addTransaction({
    id: uuidv4(), userId: user.id, type: 'pool_join', amount: -parseFloat(pool.sharePrice),
    description: `Criação do bolão "${pool.name}" - 1 cota`,
    date: new Date(), status: 'completed'
  });
  res.json({ success: true, pool: newPool });
});

app.post('/api/pools/:id/join', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const qty = parseInt(req.body.shares) || 1;
  const pool = await db.getPoolById(req.params.id);
  if (!pool) return res.status(404).json({ error: 'Bolão não encontrado' });
  const cost = qty * pool.sharePrice;
  if (pool.availableShares < qty) return res.status(400).json({ error: 'Cotas insuficientes' });
  if (cost > user.balance) return res.status(400).json({ error: 'Saldo insuficiente' });
  pool.availableShares -= qty;
  pool.participants.push({ name: user.name, shares: qty, paid: true });
  if (pool.availableShares === 0) pool.status = 'closed';
  await db.updatePool(pool.id, {
    availableShares: pool.availableShares,
    participants: pool.participants,
    status: pool.status
  });
  await db.adjustUserBalance(user.id, -cost);
  await db.addTransaction({
    id: uuidv4(), userId: user.id, type: 'pool_join', amount: -cost,
    description: `Participação no bolão "${pool.name}" - ${qty} cotas`,
    date: new Date(), status: 'completed'
  });
  await checkAchievements(user.id);
  const updated = await db.getUserById(user.id);
  res.json({ success: true, pool, balance: updated.balance });
});

// ==================== SIMULAÇÃO / IA ====================

app.post('/api/simulate', requireAuth, async (req, res) => {
  const { numbers } = req.body;
  if (!numbers || numbers.length !== 15) return res.status(400).json({ error: 'Selecione exatamente 15 números' });
  try {
    await ensureReady();
    const aiGames = geneticEngine.generateGames(1);
    const sim = simulateAI(numbers);
    return res.json({ ...sim, aiGenerated: aiGames.games ? aiGames.games[0] : null, seed_version: aiGames.seed_version });
  } catch (e) {
    res.json(simulateAI(numbers));
  }
});

app.get('/api/ai/generate', requireAuth, async (req, res) => {
  const quantity = parseInt(req.query.quantity) || 5;
  try {
    await ensureReady();
    const result = geneticEngine.generateGames(quantity);
    res.json(result);
  } catch (e) {
    res.json(generateMockAIGames(quantity));
  }
});

app.get('/api/ai/seed', requireAuth, async (req, res) => {
  try {
    await ensureReady();
    const seed = geneticEngine.getSeed();
    res.json(seed);
  } catch (e) {
    res.json({ version: '1.0.mock', game_type: 'LOTOFACIL', status: 'mock', message: 'Engine local indisponível' });
  }
});

// ==================== ROTAS DE RESULTADOS ====================

app.get('/api/results/latest', requireAuth, async (req, res) => {
  const result = await fetchLatestLotofacilResult();
  res.json(result || { error: 'Não foi possível buscar resultados' });
});

app.get('/api/results/history/recent', requireAuth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const contests = await getRecentContests(limit);
  res.json(contests);
});

app.get('/api/results/:contest', requireAuth, async (req, res) => {
  const contest = parseInt(req.params.contest);
  if (isNaN(contest)) return res.status(400).json({ error: 'Número de concurso inválido' });
  const result = await fetchLotofacilResultsByContest(contest);
  res.json(result || { error: 'Concurso não encontrado' });
});

app.get('/api/database/stats', requireAuth, async (req, res) => {
  res.json(await getDatabaseStats());
});

// ==================== NOTIFICAÇÕES API ====================

/** GET /api/notifications — Listar notificações do usuário */
app.get('/api/notifications', requireAuth, async (req, res) => {
  const notifs = await db.getUserNotifications(req.currentUser.id);
  res.json({
    notifications: notifs.slice(0, 20),
    unread: notifs.filter(n => !n.read).length,
    total: notifs.length
  });
});

/** POST /api/notifications/read-all — Marcar todas como lidas */
app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  await db.markAllNotificationsRead(req.currentUser.id);
  res.json({ success: true });
});

/** POST /api/notifications/:id/read — Marcar uma como lida */
app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
  await db.markNotificationRead(req.params.id, req.currentUser.id);
  res.json({ success: true });
});

// ==================== ENDPOINTS DA DASHBOARD TURBINADA ====================

/** GET /api/dashboard/lucky-numbers — Números da sorte do dia */
app.get('/api/dashboard/lucky-numbers', requireAuth, async (req, res) => {
  try {
    await ensureReady();
    let luckySet = new Set();
    const recent = resultsCache.slice(-50);
    const freq = Array(25).fill(0);
    recent.forEach(c => {
      if (c.listaDezenas) c.listaDezenas.forEach(n => freq[parseInt(n) - 1]++);
    });
    const hotNumbers = freq.map((f, i) => ({ n: i + 1, f }))
      .sort((a, b) => b.f - a.f)
      .slice(0, 12)
      .map(x => x.n);

    while (luckySet.size < 15) {
      if (luckySet.size < 12 && hotNumbers.length > luckySet.size) {
        const pick = hotNumbers[Math.floor(Math.random() * hotNumbers.length)];
        luckySet.add(pick);
      } else {
        luckySet.add(Math.floor(Math.random() * 25) + 1);
      }
    }

    let aiGame = null;
    try {
      const aiResult = geneticEngine.generateGames(1);
      if (aiResult && aiResult.games && aiResult.games[0]) {
        aiGame = aiResult.games[0];
      }
    } catch(e) {}

    res.json({
      luckyNumbers: [...luckySet].sort((a, b) => a - b),
      aiGenerated: aiGame,
      hotNumbers: hotNumbers.slice(0, 8),
      generatedAt: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/dashboard/portfolio-insights — Insights do portfólio do usuário */
app.get('/api/dashboard/portfolio-insights', requireAuth, async (req, res) => {
  try {
    const userId = req.currentUser.id;
    const userGs = await db.getUserGames(userId);

    const withHits = userGs.filter(g => g.usageHistory.some(u => u.hits !== null));
    const bestGames = withHits
      .map(g => ({
        id: g.id,
        name: g.name,
        numbers: g.numbers,
        bestHit: Math.max(...g.usageHistory.filter(u => u.hits !== null).map(u => u.hits), 0),
        totalPrize: g.usageHistory.reduce((s, u) => s + (u.prize || 0), 0),
        usageCount: g.usageHistory.length
      }))
      .sort((a, b) => b.bestHit - a.bestHit || b.totalPrize - a.totalPrize)
      .slice(0, 5);

    const activeGames = userGs.filter(g => g.status === 'active');
    const coverage = Array(25).fill(0);
    activeGames.forEach(g => g.numbers.forEach(n => coverage[n - 1]++));
    const coveredNums = coverage.filter(c => c > 0).length;
    const mostCovered = coverage
      .map((c, i) => ({ number: i + 1, count: c }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const missing = coverage
      .map((c, i) => ({ number: i + 1, covered: c > 0 }))
      .filter(x => !x.covered)
      .map(x => x.number);

    res.json({
      totalGames: userGs.length,
      activeGames: activeGames.length,
      coverage: {
        total: coveredNums,
        percentage: ((coveredNums / 25) * 100).toFixed(0),
        mostCovered,
        missing,
        matrix: coverage
      },
      bestGames,
      totalHits: userGs.reduce((s, g) => s + g.usageHistory.reduce((s2, u) => s2 + (u.hits || 0), 0), 0),
      totalPrizes: userGs.reduce((s, g) => s + g.usageHistory.reduce((s2, u) => s2 + (u.prize || 0), 0), 0),
      hasGames: userGs.length > 0
    });
  } catch (e) {
    res.json({ hasGames: false, error: e.message });
  }
});

/** POST /api/games/compare — Comparar múltiplos jogos */
app.post('/api/games/compare', requireAuth, async (req, res) => {
  try {
    const userId = req.currentUser.id;
    const { gameIds } = req.body;
    if (!gameIds || !Array.isArray(gameIds) || gameIds.length < 2) {
      return res.status(400).json({ error: 'Selecione pelo menos 2 jogos' });
    }

    const userGames = await db.getUserGames(userId);
    const selected = userGames.filter(g => gameIds.includes(g.id));
    if (selected.length < 2) {
      return res.status(400).json({ error: 'Jogos não encontrados' });
    }

    const pairs = [];
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        const setA = new Set(selected[i].numbers);
        const setB = new Set(selected[j].numbers);
        const intersection = [...selected[i].numbers].filter(n => setB.has(n)).length;
        const union = new Set([...selected[i].numbers, ...selected[j].numbers]).size;
        const jaccard = intersection / union;
        pairs.push({
          gameA: { id: selected[i].id, name: selected[i].name },
          gameB: { id: selected[j].id, name: selected[j].name },
          intersection,
          similarity: (jaccard * 100).toFixed(1),
          label: jaccard > 0.7 ? '🔴 Muito Similar' : jaccard > 0.4 ? '🟡 Similar' : '🟢 Diferente'
        });
      }
    }

    const allNumbers = new Set();
    selected.forEach(g => g.numbers.forEach(n => allNumbers.add(n)));
    const combinedNumbers = [...allNumbers].sort((a, b) => a - b);

    const freqMap = {};
    selected.forEach(g => g.numbers.forEach(n => { freqMap[n] = (freqMap[n] || 0) + 1; }));
    const covered = Object.keys(freqMap).map(Number);
    const uncovered = [];
    for (let i = 1; i <= 25; i++) {
      if (!covered.includes(i)) uncovered.push(i);
    }

    res.json({
      games: selected.map(g => ({ id: g.id, name: g.name, numbers: g.numbers })),
      pairs,
      combinedCoverage: {
        totalDistinct: combinedNumbers.length,
        numbers: combinedNumbers,
        coveragePct: ((combinedNumbers.length / 25) * 100).toFixed(0),
        uniqueToEach: selected.map(g => {
          const others = new Set();
          selected.forEach(o => { if (o.id !== g.id) o.numbers.forEach(n => others.add(n)); });
          return { id: g.id, name: g.name, unique: g.numbers.filter(n => !others.has(n)) };
        })
      },
      complement: {
        uncovered,
        suggestion: uncovered.length > 0
          ? 'Considere adicionar números ' + uncovered.slice(0, 8).join(', ') + ' para aumentar a cobertura'
          : 'Seus jogos cobrem todos os números!'
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== FASE 6: EXPORTAÇÃO CSV ====================

/** GET /api/games/export-csv — Exportar jogos do portfólio para CSV */
app.get('/api/games/export-csv', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const userGs = await db.getUserGames(user.id);

  const header = 'Nome;Tipo;Números;Fonte;Status;Criado em;Vezes Usada;Melhor Acerto;Total Prêmios\n';
  const rows = userGs.map(g => {
    const bestHit = g.usageHistory.length > 0 ? Math.max(...g.usageHistory.map(u => u.hits || 0)) : 0;
    const totalPrize = g.usageHistory.reduce((s, u) => s + (u.prize || 0), 0);
    return `"${g.name}";${g.gameType};"${g.numbers.join(',')}";${g.source};${g.status};${new Date(g.createdAt).toLocaleDateString('pt-BR')};${g.usageHistory.length};${bestHit};${totalPrize.toFixed(2)}`;
  }).join('\n');

  const csv = '\uFEFF' + header + rows; // BOM for Excel
  const achievements = await db.getUserAchievementIds(user.id);
  if (!achievements.includes('export_first')) {
    await db.addUserAchievement(user.id, 'export_first');
  }
  await checkAchievements(user.id);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=portfolio-jogos.csv');
  res.send(csv);
});

/** GET /api/games/performance-report — Relatório de desempenho do portfólio */
app.get('/api/games/performance-report', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const userGs = await db.getUserGames(user.id);

  const totalGames = userGs.length;
  const usedGames = userGs.filter(g => g.usageHistory.length > 0);
  const wonGames = userGs.filter(g => g.status === 'won');
  let totalSpent = 0;
  usedGames.forEach(g => {
    const cfg = LOTTERY_CONFIGS[g.gameType];
    totalSpent += (cfg ? cfg.price : 3.00) * g.usageHistory.length;
  });
  const totalPrize = usedGames.reduce((s, g) => s + g.usageHistory.reduce((s2, u) => s2 + (u.prize || 0), 0), 0);
  const roi = totalSpent > 0 ? ((totalPrize - totalSpent) / totalSpent * 100).toFixed(1) : '0.0';

  res.json({
    totalGames,
    usedGames: usedGames.length,
    wonGames: wonGames.length,
    pendingGames: totalGames - usedGames.length,
    totalSpent,
    totalPrize,
    roi,
    hitRate: usedGames.length > 0
      ? (wonGames.length / usedGames.length * 100).toFixed(1)
      : '0.0',
    bestGame: usedGames.length > 0
      ? usedGames.reduce((best, g) => {
          const gBest = Math.max(...g.usageHistory.map(u => u.hits || 0), 0);
          return gBest > (best.best || 0) ? { name: g.name, best: gBest, prize: g.usageHistory.reduce((s, u) => s + (u.prize || 0), 0) } : best;
        }, { name: '-', best: 0, prize: 0 })
      : null
  });
});

// ==================== FASE 7: MERCADO DE COTAS ====================

/** POST /api/pools/:id/create-offer — Criar oferta de venda de cotas */
app.post('/api/pools/:id/create-offer', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const pool = await db.getPoolById(req.params.id);
  if (!pool) return res.status(404).json({ error: 'Bolão não encontrado' });

  const participant = pool.participants.find(p => p.name === user.name);
  if (!participant) return res.status(400).json({ error: 'Você não participa deste bolão' });

  const sharesToSell = parseInt(req.body.shares) || 1;
  const sellPrice = parseFloat(req.body.price) || pool.sharePrice;

  if (sharesToSell > participant.shares) {
    return res.status(400).json({ error: 'Você não tem essa quantidade de cotas' });
  }

  if (!pool.marketOffers) pool.marketOffers = [];
  pool.marketOffers.push({
    id: uuidv4(),
    sellerName: user.name,
    shares: sharesToSell,
    price: sellPrice,
    totalValue: sharesToSell * sellPrice,
    createdAt: new Date().toISOString(),
    status: 'active'
  });

  await db.updatePool(pool.id, { marketOffers: pool.marketOffers });
  res.json({ success: true, offer: pool.marketOffers[pool.marketOffers.length - 1] });
});

/** POST /api/pools/:id/buy-offer/:offerId — Comprar oferta de cotas */
app.post('/api/pools/:id/buy-offer/:offerId', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const pool = await db.getPoolById(req.params.id);
  if (!pool) return res.status(404).json({ error: 'Bolão não encontrado' });

  const offer = pool.marketOffers?.find(o => o.id === req.params.offerId && o.status === 'active');
  if (!offer) return res.status(400).json({ error: 'Oferta não encontrada ou já vendida' });
  if (offer.sellerName === user.name) return res.status(400).json({ error: 'Você não pode comprar suas próprias cotas' });

  if (user.balance < offer.totalValue) {
    return res.status(400).json({ error: 'Saldo insuficiente' });
  }

  const seller = pool.participants.find(p => p.name === offer.sellerName);
  const buyer = pool.participants.find(p => p.name === user.name);

  if (seller) seller.shares -= offer.shares;
  if (buyer) { buyer.shares += offer.shares; } else { pool.participants.push({ name: user.name, shares: offer.shares, paid: true }); }

  // Transfer money: debita o comprador e credita o vendedor
  await db.adjustUserBalance(user.id, -offer.totalValue);
  const sellerUser = await db.getUserByName(offer.sellerName);
  if (sellerUser) {
    await db.adjustUserBalance(sellerUser.id, offer.totalValue);
  }

  offer.status = 'sold';
  pool.availableShares -= offer.shares;

  await db.updatePool(pool.id, { marketOffers: pool.marketOffers, participants: pool.participants, availableShares: pool.availableShares });

  await db.addTransaction({
    id: uuidv4(), userId: user.id, type: 'share_sale', amount: -offer.totalValue,
    description: `Compra de ${offer.shares} cotas de "${pool.name}" de ${offer.sellerName}`,
    date: new Date(), status: 'completed'
  });

  await addNotification(user.id, 'info', '📦 Cotas adquiridas!',
    `Você comprou ${offer.shares} cotas do bolão "${pool.name}" por R$ ${offer.totalValue.toFixed(2)}`,
    '/boloes');

  res.json({ success: true, pool });
});

// ==================== FASE 8: ASSINATURAS / APOSTAS RECORRENTES ====================

/** POST /api/subscriptions — Criar assinatura (aposta recorrente) */
app.post('/api/subscriptions', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const { gameId, gameType, numbers, name, interval = 'weekly', nextContest } = req.body;

  if (!numbers || numbers.length === 0) return res.status(400).json({ error: 'Números são obrigatórios' });

  const cfg = LOTTERY_CONFIGS[gameType || 'LOTOFACIL'];
  const sub = {
    id: uuidv4(),
    userId: user.id,
    userName: user.name,
    gameType: gameType || 'LOTOFACIL',
    numbers,
    name: name || `Assinatura ${cfg?.name || 'Lotofácil'}`,
    gameId: gameId || null,
    interval: interval || 'weekly',
    active: true,
    nextContest: nextContest || 3001,
    lastExecuted: null,
    totalExecutions: 0,
    totalSpent: 0,
    createdAt: new Date().toISOString()
  };

  await db.createSubscription(sub);
  await checkAchievements(user.id);
  await addNotification(user.id, 'info', '🔄 Assinatura criada!',
    `"${sub.name}" vai apostar automaticamente a partir do concurso ${sub.nextContest}`,
    '/configuracoes');

  res.json({ success: true, subscription: sub });
});

/** GET /api/subscriptions — Listar assinaturas do usuário */
app.get('/api/subscriptions', requireAuth, async (req, res) => {
  const userSubs = await db.getUserSubscriptions(req.currentUser.id);
  res.json({ subscriptions: userSubs, total: userSubs.length });
});

/** DELETE /api/subscriptions/:id — Remover assinatura */
app.delete('/api/subscriptions/:id', requireAuth, async (req, res) => {
  const userSubs = await db.getUserSubscriptions(req.currentUser.id);
  const sub = userSubs.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Assinatura não encontrada' });
  await db.updateSubscription(req.params.id, { active: false });
  res.json({ success: true });
});

// ==================== AUTO-RENOVAÇÃO DE ASSINATURAS (via Cron) ====================

/** Processa todas as assinaturas ativas — chamado pelo Vercel Cron */
async function processSubscriptions() {
  const now = new Date().toISOString();
  const activeSubs = await db.getActiveSubscriptions();

  for (const sub of activeSubs) {
    try {
      const cfg = LOTTERY_CONFIGS[sub.gameType] || LOTTERY_CONFIGS.LOTOFACIL;
      const user = await db.getUserById(sub.userId);
      if (!user || user.balance < cfg.price) continue;

      await db.adjustUserBalance(sub.userId, -cfg.price);

      const game = {
        id: uuidv4(),
        userId: sub.userId,
        numbers: [...sub.numbers],
        gameType: sub.gameType,
        name: `🔄 ${sub.name} (automática)`,
        source: 'ai',
        seedVersion: null,
        createdAt: now,
        status: 'active',
        usageHistory: [{
          contestNumber: sub.nextContest,
          date: now,
          hits: null,
          prize: null,
          matched: false
        }],
        poolId: null
      };
      await db.createGame(game);

      await db.updateSubscription(sub.id, {
        lastExecuted: now,
        totalExecutions: sub.totalExecutions + 1,
        totalSpent: sub.totalSpent + cfg.price,
        nextContest: sub.nextContest + 1
      });

      await db.addTransaction({
        id: uuidv4(), userId: sub.userId, type: 'subscription',
        amount: -cfg.price,
        description: `🔄 Assinatura "${sub.name}" - Concurso #${sub.nextContest}`,
        date: new Date(), status: 'completed'
      });

      await addNotification(sub.userId, 'info', '🔄 Aposta automática realizada!',
        `"${sub.name}" apostou no concurso #${sub.nextContest} (R$ ${cfg.price.toFixed(2)})`,
        '/meus-jogos');
    } catch(e) {
      console.error('Erro ao processar assinatura:', sub.id, e.message);
    }
  }
}

/** Endpoint chamado pelo Vercel Cron (ver vercel.json). Protegido por CRON_SECRET. */
app.get('/api/cron/process-subscriptions', async (req, res) => {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.authorization || '';
    const cronHeader = req.headers['x-vercel-cron'] || '';
    if (auth !== `Bearer ${expected}` && cronHeader !== expected) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
  }
  try {
    await processSubscriptions();
    // Sincroniza concursos faltantes (atualização incremental via Caixa). No
    // serverless os timers de background congelam, então o cron (1x/dia no
    // Hobby) é o lugar certo para manter o banco atualizado em produção.
    // A função já trata erros internamente (não lança).
    await syncMissingResults();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== GAMIFICAÇÃO ====================

// Conquistas disponíveis
const ACHIEVEMENTS = [
  { id: 'first_game', name: '🎯 Primeiro Jogo', desc: 'Crie seu primeiro jogo', icon: 'fa-bullseye' },
  { id: 'five_games', name: '🎲 Sortudo', desc: 'Crie 5 jogos no portfólio', icon: 'fa-dice' },
  { id: 'ten_games', name: '🏆 Veterano', desc: 'Crie 10 jogos no portfólio', icon: 'fa-trophy' },
  { id: 'twenty_games', name: '💎 Mestre dos Números', desc: 'Crie 20 jogos no portfólio', icon: 'fa-gem' },
  { id: 'ai_first', name: '🤖 Iniciação IA', desc: 'Use a IA pela primeira vez', icon: 'fa-robot' },
  { id: 'ai_five', name: '🧠 Mente Digital', desc: 'Use a IA 5 vezes', icon: 'fa-brain' },
  { id: 'pool_first', name: '👥 União', desc: 'Participe de um bolão pela primeira vez', icon: 'fa-users' },
  { id: 'pool_five', name: '🤝 Social', desc: 'Participe de 5 bolões', icon: 'fa-handshake' },
  { id: 'win_first', name: '🏅 Primeiro Prêmio', desc: 'Ganhe seu primeiro prêmio', icon: 'fa-medal' },
  { id: 'win_five', name: '🥇 Premiado', desc: 'Ganhe 5 prêmios', icon: 'fa-crown' },
  { id: 'hit_14', name: '🔥 Quase Lá', desc: 'Faça 14 acertos em um concurso', icon: 'fa-fire' },
  { id: 'hit_15', name: '🌟 Lendário', desc: 'Faça 15 acertos (Lotofácil)!', icon: 'fa-star' },
  { id: 'export_first', name: '📥 Exportador', desc: 'Exporte seu portfólio pela primeira vez', icon: 'fa-download' },
  { id: 'subscribe_first', name: '🔄 Assinante', desc: 'Crie sua primeira assinatura', icon: 'fa-repeat' },
  { id: 'share_first', name: '📢 Influenciador', desc: 'Compartilhe um jogo', icon: 'fa-share-alt' },
  { id: 'subscription_10', name: '📅 Fiel', desc: 'Acumule 10 apostas automáticas via assinatura', icon: 'fa-calendar-check' },
];

/** Nível do usuário baseado em XP */
async function getUserLevel(userId) {
  let xp = 0;
  const userGs = await db.getUserGames(userId);
  const userAchievementIds = await db.getUserAchievementIds(userId);
  xp += userGs.length * 10;
  xp += userGs.reduce((s, g) => s + g.usageHistory.length, 0) * 5;
  xp += userGs.reduce((s, g) => s + g.usageHistory.reduce((s2, u) => s2 + (u.hits || 0), 0), 0) * 3;
  xp += userAchievementIds.length * 50;
  const level = Math.floor(xp / 100) + 1;
  const nextLevelXp = level * 100;
  return {
    level,
    xp,
    nextLevelXp,
    progress: Math.min((xp / nextLevelXp) * 100, 100),
    title: level >= 50 ? 'Lendário' : level >= 30 ? 'Mestre' : level >= 15 ? 'Veterano' : level >= 5 ? 'Experiente' : 'Iniciante',
    achievements: userAchievementIds.map(id => ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean)
  };
}

/** Verificar e conceder conquistas */
async function checkAchievements(userId) {
  const userAchievementIds = await db.getUserAchievementIds(userId);
  const userGs = await db.getUserGames(userId);
  const totalGames = userGs.length;
  const totalUsed = userGs.reduce((s, g) => s + g.usageHistory.length, 0);
  const aiGames = userGs.filter(g => g.source === 'ai').length;
  const wonGames = userGs.filter(g => g.status === 'won');
  const maxHits = Math.max(0, ...userGs.flatMap(g => g.usageHistory.map(u => u.hits || 0)));
  const pools = await db.getPools();
  const user = await db.getUserById(userId);
  const poolPartCount = pools.filter(p => p.participants.some(pp => pp.name === user?.name)).length;
  const userSubs = await db.getUserSubscriptions(userId);
  const totalExecs = userSubs.reduce((s, sub) => s + sub.totalExecutions, 0);

  const checks = [
    { id: 'first_game', check: totalGames >= 1 },
    { id: 'five_games', check: totalGames >= 5 },
    { id: 'ten_games', check: totalGames >= 10 },
    { id: 'twenty_games', check: totalGames >= 20 },
    { id: 'ai_first', check: aiGames >= 1 },
    { id: 'ai_five', check: aiGames >= 5 },
    { id: 'pool_first', check: poolPartCount >= 1 },
    { id: 'pool_five', check: poolPartCount >= 5 },
    { id: 'win_first', check: wonGames.length >= 1 },
    { id: 'win_five', check: wonGames.length >= 5 },
    { id: 'hit_14', check: maxHits >= 14 },
    { id: 'hit_15', check: maxHits >= 15 },
    { id: 'subscribe_first', check: userSubs.some(s => s.active) },
    { id: 'subscription_10', check: totalExecs >= 10 },
  ];

  let newAchievements = [];
  for (const c of checks) {
    if (c.check && !userAchievementIds.includes(c.id)) {
      await db.addUserAchievement(userId, c.id);
      newAchievements.push(ACHIEVEMENTS.find(a => a.id === c.id));
    }
  }

  if (newAchievements.length > 0) {
    await addNotification(userId, 'prize', '🏅 Nova conquista!',
      `Você desbloqueou: ${newAchievements.map(a => a.name).join(', ')}!`,
      '/perfil');
  }
}

app.get('/api/gamification/level', requireAuth, async (req, res) => {
  await checkAchievements(req.currentUser.id);
  const level = await getUserLevel(req.currentUser.id);
  res.json(level);
});

app.get('/api/gamification/achievements', requireAuth, async (req, res) => {
  const userAchievementIds = await db.getUserAchievementIds(req.currentUser.id);
  const all = ACHIEVEMENTS.map(a => ({
    ...a,
    unlocked: userAchievementIds.includes(a.id)
  }));
  res.json({ achievements: all, totalUnlocked: userAchievementIds.length, total: all.length });
});

// ==================== COMPARTILHAMENTO SOCIAL ====================

app.post('/api/share/game', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const { gameId, platform } = req.body;
  const game = await db.getGameById(gameId, user.id);
  if (!game) return res.status(404).json({ error: 'Jogo não encontrado' });

  const shareText = `🎲 Meu jogo da ${LOTTERY_CONFIGS[game.gameType]?.name || 'Lotofácil'}: ${game.numbers.join(', ')}! Jogue comigo na Lotofácil Platform! 🍀`;
  const shareUrl = process.env.SITE_URL || 'https://lotofacil.local/meus-jogos';
  const encoded = encodeURIComponent(shareText + ' ' + shareUrl);

  let shareLink = '';
  switch(platform) {
    case 'whatsapp': shareLink = `https://wa.me/?text=${encoded}`; break;
    case 'telegram': shareLink = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`; break;
    case 'twitter': shareLink = `https://twitter.com/intent/tweet?text=${encoded}`; break;
    case 'facebook': shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`; break;
    default: shareLink = `https://wa.me/?text=${encoded}`; break;
  }

  const achievements = await db.getUserAchievementIds(user.id);
  if (!achievements.includes('share_first')) {
    await db.addUserAchievement(user.id, 'share_first');
  }

  res.json({ success: true, shareLink, shareText });
});

app.post('/api/share/pool', requireAuth, async (req, res) => {
  const { poolId, platform } = req.body;
  const pool = await db.getPoolById(poolId);
  if (!pool) return res.status(404).json({ error: 'Bolão não encontrado' });

  const shareText = `👥 Participe do bolão "${pool.name}" na Lotofácil Platform! ${pool.availableShares} cotas disponíveis a R$ ${pool.sharePrice.toFixed(2)}! 🍀`;
  const shareUrl = process.env.SITE_URL || 'https://lotofacil.local/boloes';
  const encoded = encodeURIComponent(shareText + ' ' + shareUrl);

  let shareLink = `https://wa.me/?text=${encoded}`;
  res.json({ success: true, shareLink, shareText });
});

app.get('/api/games/share-stats', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const userGs = await db.getUserGames(user.id);
  const won = userGs.filter(g => g.status === 'won').length;
  const totalHits = userGs.reduce((s, g) => s + g.usageHistory.reduce((s2, u) => s2 + (u.hits || 0), 0), 0);
  const maxHit = Math.max(0, ...userGs.flatMap(g => g.usageHistory.map(u => u.hits || 0)));
  const level = await getUserLevel(user.id);

  res.json({
    totalGames: userGs.length,
    wonGames: won,
    totalHits,
    maxHit,
    level: level.level,
    title: level.title,
    achievements: level.achievements.length
  });
});

// ==================== GET SINGLE GAME (APÓS rotas específicas) ====================
app.get('/api/games/:id', requireAuth, async (req, res) => {
  const game = await db.getGameById(req.params.id, req.currentUser.id);
  if (!game) return res.status(404).json({ error: 'Jogo não encontrado' });
  res.json(game);
});

// ==================== COMPARTILHAR (na Dashboard) ====================
// Lista bolões populares (com mais participantes)
app.get('/api/pools/popular', requireAuth, async (req, res) => {
  const pools = await db.getPools();
  const popular = [...pools]
    .filter(p => p.status === 'open')
    .sort((a, b) => b.participants.length - a.participants.length)
    .slice(0, 5)
    .map(p => ({
      id: p.id,
      name: p.name,
      gameType: p.gameType,
      participants: p.participants.length,
      sharePrice: p.sharePrice,
      progress: Math.round(((p.totalShares - p.availableShares) / p.totalShares) * 100)
    }));
  res.json(popular);
});

// ==================== ROTA DE ESTATÍSTICAS AVANÇADAS ====================

app.get('/estatisticas', requireAuth, (req, res) => {
  res.render('stats', {
    title: 'Estatísticas Avançadas', page: 'stats', user: req.currentUser,
    subtitle: '📊 Análise detalhada dos resultados históricos'
  });
});

/** GET /api/stats/advanced — Estatísticas avançadas dos resultados */
app.get('/api/stats/advanced', requireAuth, async (req, res) => {
  try {
    await ensureReady();
    const limit = Math.min(parseInt(req.query.limit) || 100, resultsCache.length);
    const recent = resultsCache.slice(-limit);

    if (!recent.length) {
      return res.json({ error: 'Sem dados históricos suficientes' });
    }

    const frequency = Array(25).fill(0);
    const lastAppearance = Array(25).fill(null);
    const totalContests = recent.length;
    const lastContestNumber = recent[recent.length - 1]?.numero || 0;

    recent.forEach((contest, idx) => {
      if (contest.listaDezenas) {
        contest.listaDezenas.forEach(n => {
          const i = parseInt(n) - 1;
          frequency[i]++;
          lastAppearance[i] = contest.numero;
        });
      }
    });

    const numsData = Array.from({ length: 25 }, (_, i) => ({
      number: i + 1,
      frequency: frequency[i],
      percentage: ((frequency[i] / totalContests) * 100).toFixed(1),
      gap: lastAppearance[i] ? lastContestNumber - lastAppearance[i] : totalContests,
      lastSeen: lastAppearance[i]
    }));

    const sortedByFreq = [...numsData].sort((a, b) => b.frequency - a.frequency);
    const hot = sortedByFreq.slice(0, 8);
    const cold = sortedByFreq.slice(-8).reverse();

    const gaps = [...numsData].filter(n => n.gap > 0).sort((a, b) => b.gap - a.gap);

    let totalSum = 0;
    let totalEvens = 0;
    const primeNums = new Set([2,3,5,7,11,13,17,19,23]);
    let totalPrimes = 0;

    recent.forEach(contest => {
      if (contest.listaDezenas) {
        const nums = contest.listaDezenas.map(n => parseInt(n));
        totalSum += nums.reduce((a, b) => a + b, 0);
        totalEvens += nums.filter(n => n % 2 === 0).length;
        totalPrimes += nums.filter(n => primeNums.has(n)).length;
      }
    });

    const avgSum = (totalSum / totalContests).toFixed(1);
    const avgEvens = (totalEvens / totalContests).toFixed(1);
    const avgPrimes = (totalPrimes / totalContests).toFixed(1);

    const heatmap = [];
    for (let row = 0; row < 5; row++) {
      const rowData = [];
      for (let col = 0; col < 5; col++) {
        const numIdx = row * 5 + col;
        rowData.push({
          number: numIdx + 1,
          frequency: frequency[numIdx],
          percentage: ((frequency[numIdx] / totalContests) * 100).toFixed(1)
        });
      }
      heatmap.push(rowData);
    }

    const maxFreq = Math.max(...frequency);

    res.json({
      totalContests,
      lastContest: lastContestNumber,
      heatmap,
      numbers: numsData,
      hot,
      cold,
      gaps: gaps.slice(0, 10),
      patterns: {
        avgSum,
        avgEvens,
        avgOdds: (15 - parseFloat(avgEvens)).toFixed(1),
        avgPrimes,
        avgNonPrimes: (15 - parseFloat(avgPrimes)).toFixed(1)
      },
      maxFrequency: maxFreq
    });
  } catch (e) {
    console.error('Erro nas estatísticas:', e);
    res.status(500).json({ error: e.message });
  }
});

// ==================== ROTAS DE PERFIL ====================

app.put('/api/profile', requireAuth, async (req, res) => {
  const { name, email } = req.body;
  const fields = {};
  if (name) fields.name = name;
  if (email) fields.email = email;
  await db.updateUser(req.currentUser.id, fields);
  const updated = await db.getUserById(req.currentUser.id);
  res.json({ success: true, user: sanitizeUser(updated) });
});

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

app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ==================== START SERVER / EXPORT ====================

async function startServer() {
  try {
    await ready;
    console.log('');
    console.log('============================================');
    console.log('    🎲 LOTOFÁCIL PLATFORM - SERVIDOR');
    console.log('============================================');
    console.log(`  Banco:    ${db.isNeon ? '🟢 Neon (Postgres serverless)' : '🟢 Postgres'}`);
    console.log(`  Cache:    ${resultsCache.length} concursos`);
    console.log(`  Semente:  geração ${geneticEngine.currentGeneration} · fitness ${geneticEngine.bestFitness.toFixed(4)}`);
    console.log('  Auth:     🟢 Session-based (Postgres store)');
    console.log('  Admin:    admin@lotofacil.com / 123456');
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
