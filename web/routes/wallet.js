/**
 * routes/wallet.js — Carteira digital, extraído do server.js.
 */
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { asyncRouter } = require('../lib/http');
const { requireAuth } = require('../lib/auth');
const { validate, depositSchema, withdrawSchema } = require('../lib/validation');
const { addNotification } = require('../lib/notifications');
const { formatBRL } = require('../lib/format');

const router = asyncRouter();

/** GET /api/wallet — Saldo + transações */
router.get('/api/wallet', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const userTransactions = await db.getUserTransactions(user.id);
  res.json({
    balance: user.balance, bonusBalance: user.bonusBalance,
    totalWinnings: user.totalWinnings, transactions: userTransactions
  });
});

/** POST /api/wallet/deposit — Depósito */
router.post('/api/wallet/deposit', requireAuth, validate(depositSchema), async (req, res) => {
  // `amount` já é positivo pelo depositSchema (Zod) — parseFloat é mantido por compatibilidade
  const amount = parseFloat(req.body.amount);
  const method = req.body.method || 'PIX';
  await db.adjustUserBalance(req.currentUser.id, amount);
  const txn = { id: uuidv4(), userId: req.currentUser.id, type: 'deposit', amount, description: `Depósito via ${method}`, date: new Date(), status: 'completed' };
  await db.addTransaction(txn);
  await addNotification(req.currentUser.id, 'wallet', 'Depósito realizado!',
    `${formatBRL(amount)} adicionados via ${method}.`,
    '/carteira');
  const user = await db.getUserById(req.currentUser.id);
  res.json({ success: true, transaction: txn, balance: user.balance });
});

/** POST /api/wallet/withdraw — Saque */
router.post('/api/wallet/withdraw', requireAuth, validate(withdrawSchema), async (req, res) => {
  // `amount` já é positivo pelo withdrawSchema (Zod)
  const amount = parseFloat(req.body.amount);
  const user = req.currentUser;
  if (amount > user.balance) return res.status(400).json({ error: 'Saldo insuficiente' });
  await db.adjustUserBalance(user.id, -amount);
  const txn = { id: uuidv4(), userId: user.id, type: 'withdrawal', amount: -amount, description: 'Saque para conta bancária', date: new Date(), status: 'pending' };
  await db.addTransaction(txn);
  const updated = await db.getUserById(user.id);
  res.json({ success: true, transaction: txn, balance: updated.balance });
});

module.exports = router;
