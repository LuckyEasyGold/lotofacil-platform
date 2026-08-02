/**
 * routes/ai.js — Simulação e geração com IA, extraído do server.js.
 */
const { asyncRouter } = require('../lib/http');
const { requireAuth } = require('../lib/auth');
const { geneticEngine, ensureReady, generateMockAIGames, simulateAI } = require('../lib/context');
const { validate, simulateSchema } = require('../lib/validation');
const { LOTTERY_CONFIGS } = require('../lib/lottery');

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
