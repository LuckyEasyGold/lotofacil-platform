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
const { ensureReady, getResultsCache, getNextContestNumber } = require('../lib/context');
const { buildProfile, getActiveStructure } = require('../lib/patterns');
const { buildPool, generateStructuredGames } = require('../lib/number_pool');
const { getGamePrice } = require('../lib/lottery');
const { checkPool } = require('../lib/checker');

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
  // MODELO 1 (pré-financiado): o criador paga o CUSTO REAL dos jogos do bolão
  // (tabela da Caixa) na criação. A diferença entre o arrecadado (cotas ×
  // preço) e o custo dos jogos é a TAXA ADMINISTRATIVA do criador — sempre
  // exibida de forma transparente na capa do bolão.
  const baseValue = getGamePrice(pool.gameType, pool.numbers.length);
  const totalValue = total * price;
  const adminFee = Math.max(0, Math.round((totalValue - baseValue) * 100) / 100);
  if (baseValue > user.balance) {
    return res.status(400).json({ error: 'Saldo insuficiente para financiar o bolão (custo dos jogos: ' + formatBRL(baseValue) + ')' });
  }
  const newPool = {
    id: uuidv4(), name: pool.name, gameType: pool.gameType,
    contestNumber: parseInt(pool.contestNumber, 10),
    totalShares: total,
    availableShares: Math.max(total - 1, 0),
    sharePrice: price,
    baseValue: Math.round(baseValue * 100) / 100,
    adminFee,
    minShares: 1, maxShares: Math.floor(total * 0.2),
    numbers: pool.numbers, creatorName: user.name,
    status: 'open', createdAt: new Date(),
    participants: [{ name: user.name, shares: 1, paid: true }]
  };
  await db.createPool(newPool);
  await db.adjustUserBalance(user.id, -baseValue);
  await db.addTransaction({
    id: uuidv4(), userId: user.id, type: 'pool_join', amount: -baseValue,
    description: `Pré-financiamento do bolão "${pool.name}" - custo dos jogos (${formatBRL(baseValue)})`,
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
  // MODELO 1: o criador pré-financiou os jogos → a compra de cotas o reembolsa
  // (transação transparente no extrato do criador: venda de cotas)
  const creatorUser = await db.getUserByName(pool.creatorName);
  if (creatorUser && creatorUser.id !== user.id) {
    await db.adjustUserBalance(creatorUser.id, cost);
    await db.addTransaction({
      id: uuidv4(), userId: creatorUser.id, type: 'pool_sale', amount: cost,
      description: `Venda de ${qty} cota(s) do bolão "${pool.name}" para ${user.name}`,
      date: new Date(), status: 'completed'
    });
  }
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
 * POST /api/pools/structured — Criar bolão configurável com N jogos gerados
 * pela IA estrutural (Motor 1: estrutura em vigor + Motor 2: pool de números).
 *
 * COMPOSIÇÃO (configurável): o bolão é definido pela QUANTIDADE de jogos e
 * pelas DEZENAS de cada grupo — ex.: [{pickCount:15,quantity:10},
 * {pickCount:16,quantity:5},{pickCount:17,quantity:2}]. O VALOR TOTAL do
 * bolão é a soma dos preços de todos os jogos (tabela da Caixa).
 *
 * Cotas: totalShares = nº total de jogos por padrão (1 cota por jogo).
 * sharePrice = valor total ÷ nº de cotas (ou o informado). O criador paga
 * 1 cota. Concurso: usa o PRÓXIMO (último resultado + 1) se não informado.
 * Corpo: { name, composition?, quantity?, pickCount?, sharePrice?, totalShares?, contestNumber?, poolSize?, antiRateio? }
 */
router.post('/api/pools/structured', requireAuth, validate(structuredPoolSchema), async (req, res) => {
  try {
    await ensureReady();
    const user = req.currentUser;
    const draws = getResultsCache()
      .filter(c => c && c.listaDezenas && Array.isArray(c.listaDezenas))
      .map(c => c.listaDezenas.map(n => parseInt(n, 10)));

    const { name, composition, quantity, pickCount, sharePrice, totalShares, contestNumber, poolSize, antiRateio, adminFee } = req.body;
    const profile = buildProfile(draws);
    const activeStructure = getActiveStructure(profile);
    const poolResult = buildPool(draws, { size: poolSize });

    // Gera os jogos por grupo de composição (ou fallback quantity × pickCount)
    const groups = (composition && composition.length > 0)
      ? composition
      : [{ pickCount: pickCount || 15, quantity: quantity || 10 }];

    const games = [];
    let totalValue = 0;
    for (const g of groups) {
      const pick = Math.min(g.pickCount || 15, poolResult.pool.length);
      const gs = generateStructuredGames(activeStructure, poolResult, {
        quantity: g.quantity || 1, pickCount: pick, antiRateio
      });
      games.push(...gs);
      totalValue += getGamePrice('LOTOFACIL', pick) * gs.length;
    }
    if (games.length === 0) {
      return res.status(400).json({ error: 'Não foi possível gerar jogos para esta configuração' });
    }
    if (games.length > 50) {
      return res.status(400).json({ error: 'Máximo de 50 jogos por bolão (sua composição gera ' + games.length + ')' });
    }

    // Valor total = soma dos preços de todos os jogos (proporcional à config)
    totalValue = Math.round(totalValue * 100) / 100;
    const feeValue = Math.round((parseFloat(adminFee) || 0) * 100) / 100;
    const totalWithFee = Math.round((totalValue + feeValue) * 100) / 100;
    const total = parseInt(totalShares, 10) || games.length; // 1 cota por jogo
    const price = parseFloat(sharePrice) || Math.round((totalWithFee / total) * 100) / 100;
    // MODELO 1 (pré-financiado): o criador paga o CUSTO REAL dos jogos na
    // criação. A taxa administrativa (adminFee) é opcional e transparente.
    if (totalValue > user.balance) {
      return res.status(400).json({ error: 'Saldo insuficiente para financiar o bolão (custo dos jogos: ' + formatBRL(totalValue) + ')' });
    }

    // Concurso padrão: o PRÓXIMO (o que está em destaque na tela inicial)
    const contest = parseInt(contestNumber, 10) || (await getNextContestNumber('LOTOFACIL'));

    const newPool = {
      id: uuidv4(), name, gameType: 'LOTOFACIL',
      contestNumber: contest,
      totalShares: total,
      availableShares: Math.max(total - 1, 0),
      sharePrice: price,
      baseValue: totalValue,
      adminFee: feeValue,
      minShares: 1, maxShares: Math.floor(total * 0.2),
      numbers: games[0] || [],
      games,
      creatorName: user.name,
      status: 'open', createdAt: new Date(),
      participants: [{ name: user.name, shares: 1, paid: true }]
    };
    await db.createPool(newPool);
    await db.adjustUserBalance(user.id, -totalValue);
    await db.addTransaction({
      id: uuidv4(), userId: user.id, type: 'pool_join', amount: -totalValue,
      description: `Pré-financiamento do bolão IA "${name}" - custo dos jogos (${games.length} jogos · ${formatBRL(totalValue)})`,
      date: new Date(), status: 'completed'
    });
    await addNotification(user.id, 'pool', 'Bolão IA criado!',
      `"${name}" criado com ${games.length} jogos (custo ${formatBRL(totalValue)}) no concurso ${contest} — ${formatBRL(price)} por cota${feeValue > 0 ? ' + taxa de ' + formatBRL(feeValue) : ''}.`,
      '/boloes');
    await checkAchievements(user.id); // consistência com o POST /api/pools normal
    res.json({ success: true, pool: newPool, games, totalValue: totalWithFee, baseValue: totalValue, adminFee: feeValue, contestNumber: contest, structure: activeStructure, numberPool: poolResult.pool });
  } catch (e) {
    sendError(res, e, 'POST /api/pools/structured');
  }
});

/**
 * POST /api/pools/:id/check-result — Verificar o bolão no concurso vinculado.
 * Se o resultado já saiu, calcula acertos de cada jogo, soma os prêmios e
 * divide o rateio PROPORCIONAL às cotas, creditando nas carteiras dos
 * participantes. O bolão vira 'archived' com o resultado no histórico.
 */
router.post('/api/pools/:id/check-result', requireAuth, async (req, res) => {
  try {
    const pool = await db.getPoolById(req.params.id);
    if (!pool) return res.status(404).json({ error: 'Bolão não encontrado' });
    if (pool.status === 'archived' || (pool.results || []).length > 0) {
      return res.json({ success: true, alreadyChecked: true, results: pool.results });
    }
    const r = await checkPool(pool);
    if (!r.checked) {
      const reasons = {
        'sem-concurso': 'Bolão sem concurso vinculado',
        'sem-jogos': 'Bolão sem jogos registrados',
        'sem-resultado': 'Resultado do concurso ainda não disponível'
      };
      return res.status(400).json({ error: reasons[r.reason] || 'Não foi possível verificar agora' });
    }
    const updated = await db.getPoolById(req.params.id);
    res.json({ success: true, totalPrize: r.totalPrize, games: r.games, rateio: r.rateio, results: updated.results });
  } catch (e) {
    sendError(res, e, 'POST /api/pools/:id/check-result');
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
