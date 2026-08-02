/**
 * routes/ai.js — Simulação e geração com IA, extraído do server.js.
 */
const { asyncRouter, sendError } = require('../lib/http');
const { requireAuth } = require('../lib/auth');
const { geneticEngine, ensureReady, generateMockAIGames, simulateAI, getResultsCache } = require('../lib/context');
const { validate, simulateSchema, structuredGenerateSchema } = require('../lib/validation');
const { LOTTERY_CONFIGS, getGamePrice } = require('../lib/lottery');
const { buildProfile, getActiveStructure, detectAnomalies, compareToTheoretical, getTheoreticalTable } = require('../lib/patterns');
const { buildPool, generateStructuredGames } = require('../lib/number_pool');

const router = asyncRouter();

/** POST /api/simulate — Simular jogo contra 50 sorteios simulados + jogo IA */
router.post('/api/simulate', requireAuth, validate(simulateSchema), async (req, res) => {
  const { numbers } = req.body;
  try {
    await ensureReady();
    const aiGames = geneticEngine.generateGames(1);
    const sim = simulateAI(numbers);
    return res.json({ ...sim, aiGenerated: aiGames.games ? aiGames.games[0] : null, seed_version: aiGames.seed_version });
  } catch (e) {
    res.json(simulateAI(numbers));
  }
});

/** GET /api/ai/generate — Gerar jogos com a IA */
router.get('/api/ai/generate', requireAuth, async (req, res) => {
  const quantity = Math.min(Math.max(parseInt(req.query.quantity, 10) || 5, 1), 20);
  // pickCount = quantas dezenas por jogo, limitado à tabela da Caixa da loteria
  // (15–20 na Lotofácil). O engine é específico da Lotofácil (25 números).
  const cfg = LOTTERY_CONFIGS.LOTOFACIL;
  const pickCount = Math.min(Math.max(parseInt(req.query.pickCount, 10) || cfg.pickCount, cfg.minPick), cfg.maxPick);
  try {
    await ensureReady();
    const result = geneticEngine.generateGames(quantity, pickCount);
    res.json(result);
  } catch (e) {
    res.json(generateMockAIGames(quantity, pickCount));
  }
});

/** GET /api/ai/structure-profile — Perfil estrutural aprendido (Motor 1 + Motor 2) */
router.get('/api/ai/structure-profile', requireAuth, async (req, res) => {
  try {
    await ensureReady();
    const draws = getResultsCache()
      .filter(c => c && c.listaDezenas && Array.isArray(c.listaDezenas))
      .map(c => c.listaDezenas.map(n => parseInt(n, 10)));
    const profile = buildProfile(draws);
    const activeStructure = getActiveStructure(profile);
    const anomalies = detectAnomalies(draws);
    const theoretical = compareToTheoretical(draws);
    const poolResult = buildPool(draws);
    res.json({
      success: true,
      contests: draws.length,
      structure: activeStructure,
      hot: profile.hot,
      cold: profile.cold,
      anomalies,
      theoretical,
      pool: poolResult.pool,
      hotShare: poolResult.hotShare,
      poolSize: poolResult.size,
      probabilityTable: getTheoreticalTable()
    });
  } catch (e) {
    sendError(res, e, 'GET /api/ai/structure-profile');
  }
});

/**
 * POST /api/ai/structured-generate — Gerar N jogos com a estrutura ativa
 * (Motor 1) preenchida pelo pool de números aprendido (Motor 2).
 * Corpo: { quantity, pickCount, poolSize, antiRateio }
 */
router.post('/api/ai/structured-generate', requireAuth, validate(structuredGenerateSchema), async (req, res) => {
  try {
    await ensureReady();
    const draws = getResultsCache()
      .filter(c => c && c.listaDezenas && Array.isArray(c.listaDezenas))
      .map(c => c.listaDezenas.map(n => parseInt(n, 10)));
    const { quantity, pickCount, poolSize, antiRateio } = req.body;

    const profile = buildProfile(draws);
    const activeStructure = getActiveStructure(profile);
    const poolResult = buildPool(draws, { size: poolSize });
    // pickCount não pode exceder o pool (senão retorna lista vazia com success:true)
    const actualPick = Math.min(pickCount, poolResult.pool.length);
    const games = generateStructuredGames(activeStructure, poolResult, { quantity, pickCount: actualPick, antiRateio });

    const perGame = getGamePrice('LOTOFACIL', actualPick);
    res.json({
      success: true,
      structure: activeStructure,
      pool: poolResult.pool,
      hotShare: poolResult.hotShare,
      poolSize: poolResult.size,
      games,
      pickCount: actualPick,
      perGamePrice: perGame,
      totalPrice: +(perGame * quantity).toFixed(2),
      seedVersion: '1.0.structural',
      generatedAt: new Date().toISOString()
    });
  } catch (e) {
    sendError(res, e, 'POST /api/ai/structured-generate');
  }
});

/** GET /api/ai/seed — Semente atual da IA */
router.get('/api/ai/seed', requireAuth, async (req, res) => {
  try {
    await ensureReady();
    const seed = geneticEngine.getSeed();
    res.json(seed);
  } catch (e) {
    res.json({ version: '1.0.mock', game_type: 'LOTOFACIL', status: 'mock', message: 'Engine local indisponível' });
  }
});

module.exports = router;
