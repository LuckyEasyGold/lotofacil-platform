/**
 * lib/subscriptions.js — Processamento de assinaturas recorrentes (extraído do server.js).
 */
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { LOTTERY_CONFIGS } = require('./lottery');
const { addNotification } = require('./notifications');

/** Processa todas as assinaturas ativas — chamado pelo Vercel Cron */
async function processSubscriptions() {
  const now = new Date().toISOString();
  const activeSubs = await db.getActiveSubscriptions();

  for (const sub of activeSubs) {
    try {
      const cfg = LOTTERY_CONFIGS[sub.gameType] || LOTTERY_CONFIGS.LOTOFACIL;
      const user = await db.getUserById(sub.userId);
      if (!user || user.balance < cfg.price) continue;

      await db.adjustUserBalance(sub.userId, -cfg.price);

      const game = {
        id: uuidv4(),
        userId: sub.userId,
        numbers: [...sub.numbers],
        gameType: sub.gameType,
        name: `🔄 ${sub.name} (automática)`,
        source: 'ai',
        seedVersion: null,
        createdAt: now,
        status: 'active',
        usageHistory: [{
          contestNumber: sub.nextContest,
          date: now,
          hits: null,
          prize: null,
          matched: false
        }],
        poolId: null
      };
      await db.createGame(game);

      await db.updateSubscription(sub.id, {
        lastExecuted: now,
        totalExecutions: sub.totalExecutions + 1,
        totalSpent: sub.totalSpent + cfg.price,
        nextContest: sub.nextContest + 1
      });

      await db.addTransaction({
        id: uuidv4(), userId: sub.userId, type: 'subscription',
        amount: -cfg.price,
        description: `🔄 Assinatura "${sub.name}" - Concurso #${sub.nextContest}`,
        date: new Date(), status: 'completed'
      });

      await addNotification(sub.userId, 'info', '🔄 Aposta automática realizada!',
        `"${sub.name}" apostou no concurso #${sub.nextContest} (R$ ${cfg.price.toFixed(2)})`,
        '/meus-jogos');
    } catch (e) {
      console.error('Erro ao processar assinatura:', sub.id, e.message);
    }
  }
}

module.exports = { processSubscriptions };
