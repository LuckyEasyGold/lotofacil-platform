/**
 * routes/results.js — Resultados da Lotofácil, extraído do server.js.
 */
const { asyncRouter } = require('../lib/http');
const { requireAuth } = require('../lib/auth');
const {
  fetchLatestLotofacilResult, fetchLotofacilResultsByContest,
  getRecentContests, getDatabaseStats
} = require('../lib/context');

const router = asyncRouter();

/** GET /api/results/latest — Último resultado */
router.get('/api/results/latest', requireAuth, async (req, res) => {
  const result = await fetchLatestLotofacilResult();
  res.json(result || { error: 'Não foi possível buscar resultados' });
});

/** GET /api/results/history/recent — Histórico recente */
router.get('/api/results/history/recent', requireAuth, async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  const contests = await getRecentContests(limit);
  res.json(contests);
});

/** GET /api/results/:contest — Concurso específico */
router.get('/api/results/:contest', requireAuth, async (req, res) => {
  const contest = parseInt(req.params.contest, 10);
  if (isNaN(contest)) return res.status(400).json({ error: 'Número de concurso inválido' });
  const result = await fetchLotofacilResultsByContest(contest);
  res.json(result || { error: 'Concurso não encontrado' });
});

/** GET /api/database/stats — Estatísticas do banco de resultados */
router.get('/api/database/stats', requireAuth, async (req, res) => {
  res.json(await getDatabaseStats());
});

module.exports = router;
