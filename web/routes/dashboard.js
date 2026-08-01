/**
 * routes/dashboard.js — Endpoints da dashboard, extraído do server.js.
 */
const db = require('../db');
const { asyncRouter } = require('../lib/http');
const { requireAuth, sanitizeUser } = require('../lib/auth');
const {
  geneticEngine, ensureReady, getResultsCache,
  fetchLatestLotofacilResult, getDatabaseStats
} = require('../lib/context');

const router = asyncRouter();

/** GET /api/dashboard — Resumo da dashboard */
router.get('/api/dashboard', requireAuth, async (req, res) => {
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

/** GET /api/dashboard/lucky-numbers — Números da sorte do dia */
router.get('/api/dashboard/lucky-numbers', requireAuth, async (req, res) => {
  try {
    await ensureReady();
    let luckySet = new Set();
    const recent = getResultsCache().slice(-50);
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
    } catch (e) {}

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
router.get('/api/dashboard/portfolio-insights', requireAuth, async (req, res) => {
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

module.exports = router;
