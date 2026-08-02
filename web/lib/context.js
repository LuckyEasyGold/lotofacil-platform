/**
 * lib/context.js — Estado compartilhado do servidor (extraído do server.js).
 *
 * Centraliza TUDO que é compartilhado entre as rotas:
 *  - cache progressivo de resultados (resultsCache)
 *  - semente da IA (currentSeed) + motor genético
 *  - cache de simulação
 *  - bootstrap (schema, bolões iniciais, cache, semente)
 *  - helpers de cache/APIs externas (Caixa, Guidi, free-apiloterias)
 *  - funções de IA (mock e simulação)
 *
 * As rotas (routes/*.js) importam daqui em vez de duplicar estado.
 */
const db = require('../db');
const axios = require('axios');
const LotteryGeneticEngine = require('./genetic_engine');
const { applyPriceOverrides } = require('./lottery');

// ==================== CACHE PROGRESSIVO ====================
// O cache começa só com os concursos mais recentes (boot rápido no serverless)
// e é hidratado em background até conter o histórico completo do Postgres.
const INITIAL_CACHE_SIZE = 100;   // concursos carregados no boot (primeira tela)
const HYDRATE_BATCH_SIZE = 500;   // tamanho de cada lote da hidratação em background

// ==================== LOCAL AI ENGINE (backed por Postgres) ====================
let resultsCache = [];       // cache por instância; a fonte da verdade é o Postgres
let currentSeed = null;
const simulationCache = {};

const geneticEngine = new LotteryGeneticEngine('LOTOFACIL', {
  autoEvolve: false, // não queimar CPU em cold starts do serverless
  historicalResultsProvider: () => resultsCache,
  seedProvider: () => currentSeed,
  seedSaver: (data) => {
    currentSeed = data;
    db.saveSeed('LOTOFACIL', data).catch(e => console.error('Erro ao salvar semente:', e.message));
  }
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
  // FONTE DA VERDADE: o Postgres. No serverless (Vercel), a instância pode
  // ficar quente com o cache em memória DESATUALIZADO (carregado num cold
  // start anterior à última sincronização), fazendo o app mostrar resultado
  // antigo (bug real reportado: produção mostrava #3657 enquanto o banco já
  // tinha #3750). Lendo o último concurso direto do banco, o resultado fica
  // sempre atualizado. O cache em memória vira apenas fallback.
  try {
    const fromDb = await db.getLatestResult();
    if (fromDb) return fromDb;
  } catch (e) {
    console.error('⚠️ Erro ao ler último resultado do Postgres:', e.message);
  }
  return resultsCache.length > 0 ? resultsCache[resultsCache.length - 1] : null;
}

async function getRecentContests(limit = 10) {
  await ensureReady();
  // Mesma lógica do getLatestFromDatabase: histórico vem do Postgres (fonte
  // da verdade), não do cache em memória da instância serverless — que pode
  // estar desatualizado/parcial e esvaziar o histórico na tela.
  try {
    // getRecentResults já retorna em ordem crescente (últimos N do Postgres)
    const fromDb = await db.getRecentResults(limit);
    if (fromDb.length > 0) return fromDb.reverse(); // mais recente primeiro
  } catch (e) {
    console.error('⚠️ Erro ao ler histórico do Postgres:', e.message);
  }
  if (resultsCache.length === 0) return [];
  return resultsCache.slice(-limit).reverse();
}

async function getDatabaseStats() {
  await ensureReady();
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
    const resp = await axiosGet(`${API_GUIDI}/ultimo`, 4000);
    if (resp && resp.listaDezenas) result = resp;
  } catch (e) {}
  if (!result) {
    try {
      const resp = await axiosGet(`${API_LOTERIAS_BASE}/_ultimo.json`, 4000);
      if (resp && resp.listaDezenas) result = resp;
    } catch (e) {}
  }
  if (!result) {
    try {
      const resp = await axiosGet(`${CAIXA_API_BASE}/lotofacil/latest`, 3000, { 'Accept': 'application/json' });
      if (resp && resp.listaDezenas) result = resp;
    } catch (e) {}
  }
  return result;
}

/** GET com timeout e headers — isolado para facilitar testes/mocks */
async function axiosGet(url, timeout, headers = {}) {
  const resp = await axios.get(url, { timeout, headers });
  return resp.data;
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
    const resp = await axiosGet(`${API_GUIDI}/${contestNumber}`, 4000);
    if (resp && resp.listaDezenas) { await saveToDatabase(resp); return resp; }
  } catch (e) {}
  try {
    const resp = await axiosGet(`${API_LOTERIAS_BASE}/${contestNumber}.json`, 4000);
    if (resp && resp.listaDezenas) { await saveToDatabase(resp); return resp; }
  } catch (e) {}
  try {
    const resp = await axiosGet(`${CAIXA_API_BASE}/lotofacil/${contestNumber}`, 3000, { 'Accept': 'application/json' });
    if (resp && resp.listaDezenas) { await saveToDatabase(resp); return resp; }
  } catch (e) {}
  return null;
}

/**
 * Resultado de UM concurso específico de QUALQUER loteria (multi-loteria).
 * - LOTOFACIL: cache local/Postgres + APIs externas (cascata).
 * - Outras: APIs externas direto (Guidi/free-apiloterias/Caixa pelo slug).
 * Usado pela verificação por concurso de jogos e bolões (teimosinha).
 */
async function fetchResultByContestAndType(gameType, contestNumber) {
  const slug = GAME_TYPE_SLUGS[gameType] || 'lotofacil';
  if (slug === 'lotofacil') return fetchLotofacilResultsByContest(contestNumber);

  try {
    const resp = await axiosGet(`${API_GUIDI.replace('lotofacil', slug)}/${contestNumber}`, 4000);
    if (resp && resp.listaDezenas) return resp;
  } catch (e) {}
  try {
    const resp = await axiosGet(`${API_LOTERIAS_BASE.replace('lotofacil', slug)}/${contestNumber}.json`, 4000);
    if (resp && resp.listaDezenas) return resp;
  } catch (e) {}
  try {
    const resp = await axiosGet(`${CAIXA_API_BASE}/${slug}/${contestNumber}`, 3000, { 'Accept': 'application/json' });
    if (resp && resp.listaDezenas) return resp;
  } catch (e) {}
  return null;
}

/**
 * Número do PRÓXIMO concurso de uma loteria (último resultado + 1).
 * Usado para registrar a aposta/bolão no concurso que vem (nunca no passado).
 */
async function getNextContestNumber(gameType = 'LOTOFACIL') {
  const latest = await fetchLatestResultByGameType(gameType);
  return latest && latest.numero ? parseInt(latest.numero, 10) + 1 : 3001;
}

// ==================== RESULTADO POR TIPO DE JOGO (MULTI-LOTERIA) ====================
// Slug usado nas APIs externas por tipo de jogo (Guidi / free-apiloterias / Caixa).
const GAME_TYPE_SLUGS = {
  LOTOFACIL: 'lotofacil',
  MEGASENA: 'megasena',
  QUINA: 'quina',
  LOTOMANIA: 'lotomania'
};

/**
 * Último resultado do tipo de jogo informado.
 * - LOTOFACIL: usa o cache local (Postgres) + APIs externas em background.
 * - Outras loterias: busca direto nas APIs externas (o cache é só da Lotofácil).
 * Usado pelo check-result de jogos de qualquer modalidade.
 */
async function fetchLatestResultByGameType(gameType) {
  const slug = GAME_TYPE_SLUGS[gameType] || 'lotofacil';
  if (slug === 'lotofacil') return fetchLatestLotofacilResult();

  let result = null;
  try {
    const resp = await axiosGet(`${API_GUIDI.replace('lotofacil', slug)}/ultimo`, 4000);
    if (resp && resp.listaDezenas) result = resp;
  } catch (e) {}
  if (!result) {
    try {
      const resp = await axiosGet(`${API_LOTERIAS_BASE.replace('lotofacil', slug)}/_ultimo.json`, 4000);
      if (resp && resp.listaDezenas) result = resp;
    } catch (e) {}
  }
  if (!result) {
    try {
      const resp = await axiosGet(`${CAIXA_API_BASE}/${slug}/latest`, 3000, { 'Accept': 'application/json' });
      if (resp && resp.listaDezenas) result = resp;
    } catch (e) {}
  }
  return result;
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
      const resp = await axiosGet(`${CAIXA_API_BASE}/lotofacil/latest`, 4000, { 'Accept': 'application/json' });
      if (resp && resp.numero && resp.listaDezenas) apiLatest = resp;
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

function generateMockAIGames(quantity, pickCount = 15) {
  const games = [];
  const pick = Math.min(Math.max(parseInt(pickCount, 10) || 15, 15), 20); // 15–20 dezenas (regra da Caixa)
  for (let i = 0; i < quantity; i++) {
    const numbers = new Set();
    while (numbers.size < pick) numbers.add(Math.floor(Math.random() * 25) + 1);
    games.push(Array.from(numbers).sort((a, b) => a - b));
  }
  return { game_type: 'LOTOFACIL', seed_version: '1.0.mock', pickCount: pick, games, generated_at: new Date().toISOString() };
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

// ==================== BOOTSTRAP (async) ====================
// Cria as tabelas, semeia os bolões iniciais, carrega cache de resultados
// e a semente da IA. As rotas aguardam `ready` antes de ler o cache.
async function bootstrap() {
  await db.ensureSchema();

  // Overrides de preço configurados pelo admin (tabela lottery_config).
  // Precisa rodar SEMPRE (mesmo se as linhas abaixo falharem) para que os
  // preços efetivos fiquem prontos antes de qualquer rota responder.
  try {
    const configs = await db.getLotteryConfigs();
    applyPriceOverrides(configs);
    if (configs.length > 0) console.log(`🎯 ${configs.length} tipo(s) de jogo com preços customizados (admin)`);
  } catch (e) {
    console.error('⚠️ Erro ao carregar config de loterias:', e.message);
  }

  // Bolões iniciais (se a tabela estiver vazia)
  const pools = await db.getPools();
  if (pools.length === 0) {
    await db.createPool({
      id: '974eb2c7-002b-41dc-902b-880d0cc362e3', name: 'Bolão da Sorte', gameType: 'LOTOFACIL', contestNumber: 3005,
      totalShares: 100, availableShares: 45, sharePrice: 25.00, minShares: 1, maxShares: 20,
      numbers: [1,2,5,6,9,10,11,12,15,17,18,19,21,24,25],
      creatorName: 'Maria', status: 'open', createdAt: new Date(),
      participants: [{ name: 'Maria', shares: 10, paid: true }, { name: 'João', shares: 5, paid: true }]
    });
    await db.createPool({
      id: '3f1daf61-8a33-498f-be64-cbd92fdb530e', name: 'Mega Bolão LF', gameType: 'LOTOFACIL', contestNumber: 3006,
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
  // No Vercel (serverless), timers de background congelam após a resposta HTTP.
  // Estratégia à prova de cold start:
  //  1) carrega os 100 mais recentes SEMPRE (boot rápido e garantido);
  //  2) tenta o histórico completo para a IA aprender com tudo, com timeout
  //     de 8s — se o cold start for lento, cai para os últimos 500;
  //  3) o load da IA abaixo (loadHistoricalResults) roda em QUALQUER caso,
  //     pois o cache sempre tem pelo menos os 100 iniciais.
  if (process.env.VERCEL === '1') {
    resultsCache = await db.getRecentResults(INITIAL_CACHE_SIZE);
    console.log(`📦 Vercel boot: ${resultsCache.length} concursos (mais recentes)`);
    // Na suíte de testes (NODE_ENV=test) não tentamos o histórico completo:
    // cada arquivo reimporta o server.js e um load de 3750 concursos com
    // timeout de 8s tornaria a suíte lenta/instável. As rotas de results
    // funcionam com o cache recente + busca sob demanda no Postgres.
    if (process.env.NODE_ENV !== 'test') {
      let timer;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout 8s no histórico completo')), 8000);
      });
      try {
        resultsCache = await Promise.race([db.getResults(), timeoutPromise]);
        console.log(`✅ Vercel: histórico completo carregado (${resultsCache.length} concursos)`);
      } catch (e) {
        console.error(`⚠️ Vercel: ${e.message} — usando os últimos 500`);
        try { resultsCache = await db.getRecentResults(500); } catch (e2) { /* mantém os 100 do boot */ }
      } finally {
        clearTimeout(timer);
      }
    }
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

// ==================== EXPORTS ====================
// ATENÇÃO: resultsCache/currentSeed são `let` reatribuídos (boot/hidratação).
// Exportá-los por valor congelaria a referência inicial — por isso expomos
// GETTERS que leem a variável viva a cada chamada.
function getResultsCache() { return resultsCache; }
function getCurrentSeed() { return currentSeed; }

module.exports = {
  db,
  geneticEngine,
  getResultsCache,     // getter — leitura SEMPRE atual
  getCurrentSeed,      // getter — leitura SEMPRE atual
  INITIAL_CACHE_SIZE,
  HYDRATE_BATCH_SIZE,
  API_GUIDI,
  API_LOTERIAS_BASE,
  CAIXA_API_BASE,
  bootstrap,
  ensureReady,
  ready,
  saveToDatabase,
  findInDatabase,
  getLatestFromDatabase,
  getRecentContests,
  getDatabaseStats,
  tryFetchFromExternalAPIs,
  fetchLatestLotofacilResult,
  fetchLatestResultByGameType,
  fetchLotofacilResultsByContest,
  fetchResultByContestAndType,
  getNextContestNumber,
  hydrateCacheInBackground,
  syncMissingResults,
  generateMockAIGames,
  simulateAI
};
