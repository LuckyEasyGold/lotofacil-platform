/**
 * routes/admin.js — Painel admin (somente admin), extraído do server.js.
 *
 * Inclui:
 *  - Evolução da IA (/evolucao + /api/ai/evolution-history + /api/ai/evolve)
 *  - Config de loterias (preços por quantidade de dezenas, conforme a Caixa):
 *      GET /api/admin/lottery-config  → tabela efetiva + overrides
 *      PUT /api/admin/lottery-config  → salva override de preço
 */
const { asyncRouter } = require('../lib/http');
const { requireAuth, requireAdmin } = require('../lib/auth');
const { geneticEngine, ensureReady } = require('../lib/context');
const { validate, evolveSchema, lotteryConfigSchema } = require('../lib/validation');
const { getLotteries, getPriceOverrides, applyPriceOverrides } = require('../lib/lottery');
const db = require('../db');
const { sendError } = require('../lib/http');

const router = asyncRouter();

/** GET /evolucao — Página de evolução (admin) */
router.get('/evolucao', requireAuth, requireAdmin, async (req, res) => {
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
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/** GET /api/ai/evolution-history — Histórico de evolução (admin) */
router.get('/api/ai/evolution-history', requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureReady();
    res.json(geneticEngine.getEvolutionHistory());
  } catch (e) {
    sendError(res, e, 'GET /api/ai/evolution-history');
  }
});

/** POST /api/ai/evolve — Evoluir a IA (admin) */
router.post('/api/ai/evolve', requireAuth, requireAdmin, validate(evolveSchema), async (req, res) => {
  const generations = parseInt(req.body.generations, 10) || 10;
  try {
    await ensureReady();
    const result = await geneticEngine.evolveMore(generations);
    res.json({ success: true, evolution: result });
  } catch (e) {
    if (e.message === 'Evolução já em andamento') {
      res.status(409).json({ error: 'Já existe uma evolução em andamento', evolving: true });
    } else {
      sendError(res, e, 'POST /api/ai/evolve');
    }
  }
});

/** GET /api/ai/evolve/status — Estado da evolução (admin) */
router.get('/api/ai/evolve/status', requireAuth, requireAdmin, (req, res) => {
  res.json({ evolving: geneticEngine.isEvolving() });
});

// ==================== CONFIG DE LOTERIAS (PREÇOS) ====================

/** GET /api/admin/lottery-config — Tabela de preços efetiva + overrides (admin) */
router.get('/api/admin/lottery-config', requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json({
      lotteries: getLotteries(),
      overrides: getPriceOverrides()
    });
  } catch (e) {
    sendError(res, e, 'GET /api/admin/lottery-config');
  }
});

/**
 * PUT /api/admin/lottery-config — Sobrescreve o preço por quantidade de dezenas.
 * Body: { gameType: 'LOTOFACIL', prices: { "16": 48.00, "17": 408.00 } }
 * Persiste no banco e aplica em memória (efeito imediato nas rotas).
 */
router.put('/api/admin/lottery-config', requireAuth, requireAdmin, validate(lotteryConfigSchema), async (req, res) => {
  try {
    const { gameType, prices } = req.body;
    // Validação de negócio: quantidade precisa estar no range permitido da loteria
    const cfg = getLotteries().find(l => l.key === gameType);
    const clean = {};
    for (const [pick, price] of Object.entries(prices)) {
      const n = parseInt(pick, 10);
      if (!cfg || n < cfg.minPick || n > cfg.maxPick) {
        return res.status(400).json({ error: `${n} dezenas fora do permitido (${cfg ? cfg.minPick + '-' + cfg.maxPick : '?'}) para ${gameType}` });
      }
      clean[n] = Number(price);
    }
    await db.saveLotteryConfig(gameType, clean);
    applyPriceOverrides(await db.getLotteryConfigs());
    res.json({ success: true, lotteries: getLotteries() });
  } catch (e) {
    sendError(res, e, 'PUT /api/admin/lottery-config');
  }
});

/** DELETE /api/admin/lottery-config/:gameType — Remove o override (volta à Caixa) */
router.delete('/api/admin/lottery-config/:gameType', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.pool.query('DELETE FROM lottery_config WHERE game_type = $1', [req.params.gameType]);
    applyPriceOverrides(await db.getLotteryConfigs());
    res.json({ success: true, lotteries: getLotteries() });
  } catch (e) {
    sendError(res, e, 'DELETE /api/admin/lottery-config');
  }
});

module.exports = router;
