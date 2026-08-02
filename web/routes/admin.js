/**
 * routes/admin.js — Evolução da IA (somente admin), extraído do server.js.
 */
const { asyncRouter } = require('../lib/http');
const { requireAuth, requireAdmin } = require('../lib/auth');
const { geneticEngine, ensureReady } = require('../lib/context');
const { validate, evolveSchema } = require('../lib/validation');
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

module.exports = router;
