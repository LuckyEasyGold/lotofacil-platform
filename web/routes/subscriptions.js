/**
 * routes/subscriptions.js — Assinaturas recorrentes + cron, extraído do server.js.
 */
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { asyncRouter } = require('../lib/http');
const { requireAuth } = require('../lib/auth');
const { LOTTERY_CONFIGS } = require('../lib/lottery');
const { addNotification } = require('../lib/notifications');
const { checkAchievements } = require('../lib/gamification');
const { syncMissingResults } = require('../lib/context');
const { processSubscriptions } = require('../lib/subscriptions');
const { validate, createSubscriptionSchema } = require('../lib/validation');
const { sendError } = require('../lib/http');

const router = asyncRouter();

/** POST /api/subscriptions — Criar assinatura (aposta recorrente) */
router.post('/api/subscriptions', requireAuth, validate(createSubscriptionSchema), async (req, res) => {
  const user = req.currentUser;
  const { gameId, gameType, numbers, name, interval = 'weekly', nextContest } = req.body;

  const cfg = LOTTERY_CONFIGS[gameType || 'LOTOFACIL'];
  const sub = {
    id: uuidv4(),
    userId: user.id,
    userName: user.name,
    gameType: gameType || 'LOTOFACIL',
    numbers,
    name: name || `Assinatura ${cfg?.name || 'Lotofácil'}`,
    gameId: gameId || null,
    interval: interval || 'weekly',
    active: true,
    nextContest: nextContest || 3001,
    lastExecuted: null,
    totalExecutions: 0,
    totalSpent: 0,
    createdAt: new Date().toISOString()
  };

  await db.createSubscription(sub);
  await checkAchievements(user.id);
  await addNotification(user.id, 'sub', 'Assinatura criada!',
    `"${sub.name}" vai apostar automaticamente a partir do concurso ${sub.nextContest}`,
    '/configuracoes');

  res.json({ success: true, subscription: sub });
});

/** GET /api/subscriptions — Listar assinaturas do usuário */
router.get('/api/subscriptions', requireAuth, async (req, res) => {
  const userSubs = await db.getUserSubscriptions(req.currentUser.id);
  res.json({ subscriptions: userSubs, total: userSubs.length });
});

/** DELETE /api/subscriptions/:id — Remover assinatura */
router.delete('/api/subscriptions/:id', requireAuth, async (req, res) => {
  const userSubs = await db.getUserSubscriptions(req.currentUser.id);
  const sub = userSubs.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Assinatura não encontrada' });
  await db.updateSubscription(req.params.id, { active: false });
  res.json({ success: true });
});

/** Endpoint chamado pelo Vercel Cron (ver vercel.json). Protegido por CRON_SECRET. */
router.get('/api/cron/process-subscriptions', async (req, res) => {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.authorization || '';
    const cronHeader = req.headers['x-vercel-cron'] || '';
    if (auth !== `Bearer ${expected}` && cronHeader !== expected) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
  }
  try {
    await processSubscriptions();
    // Sincroniza concursos faltantes (atualização incremental via Caixa). No
    // serverless os timers de background congelam, então o cron (1x/dia no
    // Hobby) é o lugar certo para manter o banco atualizado em produção.
    await syncMissingResults();
    res.json({ success: true });
  } catch (e) {
    sendError(res, e, 'GET /api/cron/process-subscriptions');
  }
});

module.exports = router;
