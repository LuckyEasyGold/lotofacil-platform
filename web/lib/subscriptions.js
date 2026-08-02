/**
 * lib/subscriptions.js — Processamento de assinaturas recorrentes (extraído do server.js).
 */
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { getGamePrice } = require('./lottery');
const { addNotification } = require('./notifications');
const { formatBRL } = require('./format');

/** Processa todas as assinaturas ativas — chamado pelo Vercel Cron */
async function processSubscriptions() {
  const now = new Date().toISOString();
  const activeSubs = await db.getActiveSubscriptions();

  for (const sub of activeSubs) {
    try {
      // Preço oficial por quantidade de dezenas (tabela da Caixa, com override admin)
      const price = getGamePrice(sub.gameType, sub.numbers.length);
      const user = await db.getUserById(sub.userId);
      if (!user || user.balance < price) continue;

      await db.adjustUserBalance(sub.userId, -price);

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
        totalSpent: sub.totalSpent + price,
        nextContest: sub.nextContest + 1
      });

      await db.addTransaction({
        id: uuidv4(), userId: sub.userId, type: 'subscription',
        amount: -price,
        description: `🔄 Assinatura "${sub.name}" - Concurso #${sub.nextContest}`,
        date: new Date(), status: 'completed'
      });

      await addNotification(sub.userId, 'sub', 'Aposta automática realizada!',
        `"${sub.name}" apostou no concurso #${sub.nextContest} (${formatBRL(price)})`,
        '/meus-jogos');
    } catch (e) {
      console.error('Erro ao processar assinatura:', sub.id, e.message);
    }
  }
}

module.exports = { processSubscriptions };
