/**
 * routes/stats.js — Estatísticas avançadas, extraído do server.js.
 */
const { asyncRouter } = require('../lib/http');
const { requireAuth } = require('../lib/auth');
const { ensureReady, getResultsCache } = require('../lib/context');

const router = asyncRouter();

/** GET /api/stats/advanced — Estatísticas avançadas dos resultados */
router.get('/api/stats/advanced', requireAuth, async (req, res) => {
  try {
    await ensureReady();
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, getResultsCache().length);
    const recent = getResultsCache().slice(-limit);

    if (!recent.length) {
      return res.json({ error: 'Sem dados históricos suficientes' });
    }

    const frequency = Array(25).fill(0);
    const lastAppearance = Array(25).fill(null);
    const totalContests = recent.length;
    const lastContestNumber = recent[recent.length - 1]?.numero || 0;

    recent.forEach(contest => {
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
    const primeNums = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23]);
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

module.exports = router;
