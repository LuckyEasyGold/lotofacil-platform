/**
 * routes/bets.js — Apostas, extraído do server.js.
 */
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { asyncRouter } = require('../lib/http');
const { requireAuth } = require('../lib/auth');
const { validate, createBetSchema } = require('../lib/validation');

const router = asyncRouter();

/** POST /api/bets — Criar aposta (debita da carteira) */
router.post('/api/bets', requireAuth, validate(createBetSchema), async (req, res) => {
  try {
    const { gameType, numbers, amount } = req.body;
    const user = req.currentUser;
    const bet = { id: uuidv4(), gameType, numbers, amount, date: new Date(), status: 'active', userId: user.id };
    await db.addBet(bet);
    await db.adjustUserBalance(user.id, -amount);
    await db.addTransaction({
      id: uuidv4(), userId: user.id, type: 'bet', amount: -amount,
      description: `Aposta Lotofácil - ${numbers.length} números`,
      date: new Date(), status: 'completed'
    });
    res.json({ success: true, bet });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/bets — Listar apostas do usuário */
router.get('/api/bets', requireAuth, async (req, res) => {
  const userBets = await db.getUserBets(req.currentUser.id);
  res.json(userBets);
});

/** GET /api/bets/my — Alias */
router.get('/api/bets/my', requireAuth, async (req, res) => {
  const userBets = await db.getUserBets(req.currentUser.id);
  res.json(userBets);
});

module.exports = router;
