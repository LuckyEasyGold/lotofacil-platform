/**
 * routes/games.js — Portfólio de jogos, extraído do server.js.
 * Inclui CRUD, stats, use, check-result, create-pool, duplicate, compare,
 * export-csv, performance-report e share-stats.
 */
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { asyncRouter } = require('../lib/http');
const { requireAuth } = require('../lib/auth');
const { PRIZE_TABLES, getGamePrice } = require('../lib/lottery');
const { addNotification } = require('../lib/notifications');
const { checkAchievements, getUserLevel } = require('../lib/gamification');
const { fetchLatestResultByGameType } = require('../lib/context');
const { validate, createGameSchema } = require('../lib/validation');
const { sendError } = require('../lib/http');

const router = asyncRouter();

/** POST /api/games — Salvar um jogo no portfólio */
router.post('/api/games', requireAuth, validate(createGameSchema), async (req, res) => {
  try {
    const user = req.currentUser;
    // Validação de quantidade/range/duplicados/gameType já é garantida pelo
    // createGameSchema (Zod, lib/validation.js) via validate() acima.
    const { numbers, gameType, name, source, seedVersion } = req.body;
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
    sendError(res, e, 'POST /api/games');
  }
});

/** GET /api/games — Listar jogos do usuário (com filtros) */
router.get('/api/games', requireAuth, async (req, res) => {
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
router.get('/api/games/stats', requireAuth, async (req, res) => {
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
router.put('/api/games/:id', requireAuth, async (req, res) => {
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
router.delete('/api/games/:id', requireAuth, async (req, res) => {
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
router.post('/api/games/:id/use', requireAuth, async (req, res) => {
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
router.post('/api/games/:id/check-result', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const game = await db.getGameById(req.params.id, user.id);
  if (!game) return res.status(404).json({ error: 'Jogo não encontrado' });
  try {
    // Resultado da LOTERIA do jogo (não mais sempre Lotofácil): o check-result
    // agora funciona para Lotofácil, Mega-Sena, Quina e Lotomania.
    const latest = await fetchLatestResultByGameType(game.gameType);
    if (!latest || !latest.listaDezenas) {
      return res.status(400).json({ error: 'Não foi possível obter o resultado desta loteria' });
    }
    const drawnNumbers = latest.listaDezenas.map(n => parseInt(n));
    const drawnSet = new Set(drawnNumbers);
    const hits = game.numbers.filter(n => drawnSet.has(n)).length;
    // Tabela oficial de prêmios por tipo de jogo (lib/lottery.js → PRIZE_TABLES).
    // Um jogo está premiado quando o nº de acertos existe na tabela de prêmios
    // do seu tipo (ex.: Lotofácil 11+, Mega-Sena 4+, Quina 3+).
    const prizeTable = PRIZE_TABLES[game.gameType] || PRIZE_TABLES.LOTOFACIL;
    const prize = prizeTable[hits] || 0;
    const isWinner = prize > 0;
    const lastUsage = game.usageHistory[game.usageHistory.length - 1];
    if (lastUsage) {
      lastUsage.hits = hits;
      lastUsage.prize = prize;
      lastUsage.matched = isWinner;
      lastUsage.contestNumber = latest.numero;
    }
    if (isWinner) {
      game.status = 'won';
      await checkAchievements(user.id);
      if (prize > 0) {
        await db.adjustUserBalance(user.id, prize);
        await db.adjustUserWinnings(user.id, prize);
        await db.addTransaction({
          id: uuidv4(), userId: user.id, type: 'prize', amount: prize,
          description: `🏆 Prêmio de ${hits} acertos - Concurso ${latest.numero}`,
          date: new Date(), status: 'completed'
        });        await addNotification(user.id, 'prize', 'Jogo premiado!',
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
      isWinner
    }});
  } catch (e) {
    sendError(res, e, 'POST /api/games/:id/check-result');
  }
});

/** POST /api/games/:id/create-pool — Criar bolão a partir de um jogo */
router.post('/api/games/:id/create-pool', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const game = await db.getGameById(req.params.id, user.id);
  if (!game) return res.status(404).json({ error: 'Jogo não encontrado' });
  const { name, totalShares, sharePrice } = req.body;
  // Números de cotas calculados UMA vez (evita re-parse + bug de edge case:
  // antes, `parseInt(totalShares) - 1 || 49` virava 49 quando totalShares=1,
  // pois 1-1=0 e `0 || 49` = 49).
  const total = parseInt(totalShares, 10) || 50;
  const price = parseFloat(sharePrice) || 25.00;
  if (price > user.balance) {
    return res.status(400).json({ error: 'Saldo insuficiente' });
  }
  const newPool = {
    id: uuidv4(),
    name: name || `Bolão ${game.name}`,
    gameType: game.gameType,
    contestNumber: parseInt(req.body.contestNumber, 10) || 3005,
    totalShares: total,
    availableShares: Math.max(total - 1, 0),
    sharePrice: price,
    minShares: 1,
    maxShares: Math.floor(total * 0.2),
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
  await db.adjustUserBalance(user.id, -price);
  await db.addTransaction({
    id: uuidv4(), userId: user.id, type: 'pool_join', amount: -price,
    description: `Criação do bolão "${newPool.name}" - 1 cota`,
    date: new Date(), status: 'completed'
  });
  res.json({ success: true, pool: newPool });
});

/** POST /api/games/:id/duplicate — Duplicar jogo (reusar números) */
router.post('/api/games/:id/duplicate', requireAuth, async (req, res) => {
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

/** POST /api/games/compare — Comparar múltiplos jogos */
router.post('/api/games/compare', requireAuth, async (req, res) => {
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
    sendError(res, e, 'POST /api/games/compare');
  }
});

/** GET /api/games/export-csv — Exportar jogos do portfólio para CSV */
router.get('/api/games/export-csv', requireAuth, async (req, res) => {
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
router.get('/api/games/performance-report', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const userGs = await db.getUserGames(user.id);

  const totalGames = userGs.length;
  const usedGames = userGs.filter(g => g.usageHistory.length > 0);
  const wonGames = userGs.filter(g => g.status === 'won');
  let totalSpent = 0;
  usedGames.forEach(g => {
    // Preço oficial por quantidade de dezenas (tabela da Caixa, com override admin)
    totalSpent += getGamePrice(g.gameType, g.numbers.length) * g.usageHistory.length;
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

/** GET /api/games/share-stats — Estatísticas do portfólio para compartilhamento */
router.get('/api/games/share-stats', requireAuth, async (req, res) => {
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

/** GET /api/games/:id — Buscar um jogo (DEVE vir por último: :id pegaria rotas específicas) */
router.get('/api/games/:id', requireAuth, async (req, res) => {
  const game = await db.getGameById(req.params.id, req.currentUser.id);
  if (!game) return res.status(404).json({ error: 'Jogo não encontrado' });
  res.json(game);
});

module.exports = router;
