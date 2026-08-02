/**
 * routes/pools.js — Bolões e mercado de cotas, extraído do server.js.
 */
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { asyncRouter, sendError } = require('../lib/http');
const { requireAuth } = require('../lib/auth');
const { addNotification } = require('../lib/notifications');
const { checkAchievements } = require('../lib/gamification');
const { validate, createPoolSchema, joinPoolSchema, createOfferSchema, structuredPoolSchema } = require('../lib/validation');
const { formatBRL } = require('../lib/format');
const { ensureReady, getResultsCache } = require('../lib/context');
const { buildProfile, getActiveStructure } = require('../lib/patterns');
const { buildPool, generateStructuredGames } = require('../lib/number_pool');
const { getGamePrice } = require('../lib/lottery');

const router = asyncRouter();

/** GET /api/pools — Listar bolões */
router.get('/api/pools', requireAuth, async (req, res) => {
  res.json(await db.getPools());
});

/** POST /api/pools — Criar bolão */
router.post('/api/pools', requireAuth, validate(createPoolSchema), async (req, res) => {
  const user = req.currentUser;
  const pool = req.body;
  const total = parseInt(pool.totalShares, 10);
  const price = parseFloat(pool.sharePrice);
  // Checagem de saldo ANTES de debitar (mesma regra do join).
  if (price > user.balance) {
    return res.status(400).json({ error: 'Saldo insuficiente' });
  }
  const newPool = {
    id: uuidv4(), name: pool.name, gameType: pool.gameType,
    contestNumber: parseInt(pool.contestNumber, 10),
    totalShares: total,
    availableShares: Math.max(total - 1, 0),
    sharePrice: price,
    minShares: 1, maxShares: Math.floor(total * 0.2),
    numbers: pool.numbers, creatorName: user.name,
    status: 'open', createdAt: new Date(),
    participants: [{ name: user.name, shares: 1, paid: true }]
  };
  await db.createPool(newPool);
  await db.adjustUserBalance(user.id, -price);
  await db.addTransaction({
    id: uuidv4(), userId: user.id, type: 'pool_join', amount: -price,
    description: `Criação do bolão "${pool.name}" - 1 cota`,
    date: new Date(), status: 'completed'
  });
  await addNotification(user.id, 'pool', 'Bolão criado!',
    `"${pool.name}" criado com ${total} cotas a ${formatBRL(price)} — compartilhe para vender mais!`,
    '/boloes');
  res.json({ success: true, pool: newPool });
});

/** POST /api/pools/:id/join — Entrar em um bolão */
router.post('/api/pools/:id/join', requireAuth, validate(joinPoolSchema), async (req, res) => {
  const user = req.currentUser;
  const qty = parseInt(req.body.shares, 10) || 1;
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
  await addNotification(user.id, 'pool', 'Entrou no bolão!',
    `Você comprou ${qty} cota(s) do bolão "${pool.name}" (${formatBRL(qty * pool.sharePrice)})`,
    '/boloes');
  const updated = await db.getUserById(user.id);
  res.json({ success: true, pool, balance: updated.balance });
});

/** POST /api/pools/:id/create-offer — Criar oferta de venda de cotas */
router.post('/api/pools/:id/create-offer', requireAuth, validate(createOfferSchema), async (req, res) => {
  const user = req.currentUser;
  const pool = await db.getPoolById(req.params.id);
  if (!pool) return res.status(404).json({ error: 'Bolão não encontrado' });

  const participant = pool.participants.find(p => p.name === user.name);
  if (!participant) return res.status(400).json({ error: 'Você não participa deste bolão' });

  const sharesToSell = parseInt(req.body.shares, 10) || 1;
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
router.post('/api/pools/:id/buy-offer/:offerId', requireAuth, async (req, res) => {
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

  await addNotification(user.id, 'pool', 'Cotas adquiridas!',
    `Você comprou ${offer.shares} cotas do bolão "${pool.name}" por ${formatBRL(offer.totalValue)}`,
    '/boloes');

  res.json({ success: true, pool });
});

/**
 * POST /api/pools/structured — Criar bolão com N jogos gerados pela IA
 * estrutural (Motor 1: estrutura em vigor + Motor 2: pool de números).
 * Cada cota custa o valor de 1 jogo (tabela da Caixa, ex.: R$ 3,50) e o
 * bolão tem `quantity` cotas (1 por jogo) — ou `totalShares` se informado.
 * Corpo: { name, quantity, pickCount, sharePrice, totalShares, contestNumber, poolSize, antiRateio }
 */
router.post('/api/pools/structured', requireAuth, validate(structuredPoolSchema), async (req, res) => {
  try {
    await ensureReady();
    const user = req.currentUser;
    const draws = getResultsCache()
      .filter(c => c && c.listaDezenas && Array.isArray(c.listaDezenas))
      .map(c => c.listaDezenas.map(n => parseInt(n, 10)));

    const { name, quantity, pickCount, sharePrice, totalShares, contestNumber, poolSize, antiRateio } = req.body;
    const profile = buildProfile(draws);
    const activeStructure = getActiveStructure(profile);
    const poolResult = buildPool(draws, { size: poolSize });
    const actualPick = Math.min(pickCount, poolResult.pool.length);
    const games = generateStructuredGames(activeStructure, poolResult, { quantity, pickCount: actualPick, antiRateio });

    // Custo: quantity jogos × preço da tabela. Cota = valor de 1 jogo (ou o
    // informado). totalShares = quantity por padrão (1 cota por jogo).
    // Usa actualPick (clampado ao pool) para o preço bater com os jogos gerados.
    const perGame = getGamePrice('LOTOFACIL', actualPick);
    const price = parseFloat(sharePrice) || perGame;
    const total = parseInt(totalShares, 10) || quantity;
    if (price > user.balance) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    const newPool = {
      id: uuidv4(), name, gameType: 'LOTOFACIL',
      contestNumber: parseInt(contestNumber, 10) || 3005,
      totalShares: total,
      availableShares: Math.max(total - 1, 0),
      sharePrice: price,
      minShares: 1, maxShares: Math.floor(total * 0.2),
      numbers: games[0] || [],
      games,
      creatorName: user.name,
      status: 'open', createdAt: new Date(),
      participants: [{ name: user.name, shares: 1, paid: true }]
    };
    await db.createPool(newPool);
    await db.adjustUserBalance(user.id, -price);
    await db.addTransaction({
      id: uuidv4(), userId: user.id, type: 'pool_join', amount: -price,
      description: `Criação do bolão IA "${name}" - 1 cota (${quantity} jogos)`,
      date: new Date(), status: 'completed'
    });
    await addNotification(user.id, 'pool', 'Bolão IA criado!',
      `"${name}" criado com ${games.length} jogos gerados pela IA estrutural — ${formatBRL(price)} por cota.`,
      '/boloes');
    await checkAchievements(user.id); // consistência com o POST /api/pools normal
    res.json({ success: true, pool: newPool, games, structure: activeStructure, numberPool: poolResult.pool, perGame });
  } catch (e) {
    sendError(res, e, 'POST /api/pools/structured');
  }
});

/** GET /api/pools/popular — Bolões populares (dashboard) */
router.get('/api/pools/popular', requireAuth, async (req, res) => {
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

module.exports = router;
