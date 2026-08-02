/**
 * routes/bets.js — Apostas, extraído do server.js.
 *
 * O preço da aposta é SEMPRE calculado no servidor (tabela oficial da Caixa
 * em lib/lottery.js) — o `amount` enviado pelo cliente é ignorado, evitando
 * que o usuário pague um valor diferente do real.
 *
 * A aposta também cria/vincula o jogo no portfólio de forma atômica: antes o
 * frontend salvava o jogo DEPOIS da aposta (e só se ela desse certo), então um
 * jogo confirmado como aposta podia sumir do "Meus Jogos". Agora o jogo nasce
 * junto com a aposta (source 'bet') ou é vinculado ao jogo existente (gameId).
 */
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { asyncRouter } = require('../lib/http');
const { requireAuth } = require('../lib/auth');
const { validate, createBetSchema } = require('../lib/validation');
const { getGamePrice, LOTTERY_CONFIGS } = require('../lib/lottery');
const { addNotification } = require('../lib/notifications');
const { sendError } = require('../lib/http');
const { formatBRL } = require('../lib/format');
const { getNextContestNumber } = require('../lib/context');

const router = asyncRouter();

/**
 * POST /api/bets — Criar aposta (debita da carteira).
 *
 * TEIMOSINHA: o corpo aceita `contests` (1-30). A aposta vale para o PRÓXIMO
 * concurso (último resultado + 1) e, com contests > 1, para os N concursos
 * seguintes. O valor cobrado é N × preço do jogo (calculado no servidor).
 * O jogo no portfólio nasce com usageHistory já preenchido para cada concurso,
 * e a verificação diária (lib/checker.js) confere cada um quando o resultado sair.
 */
router.post('/api/bets', requireAuth, validate(createBetSchema), async (req, res) => {
  try {
    const { gameType, numbers, gameId } = req.body;
    const contests = Math.min(Math.max(parseInt(req.body.contests, 10) || 1, 1), 30);
    const user = req.currentUser;
    const sorted = [...numbers].sort((a, b) => a - b);

    // Preço oficial calculado no servidor (o amount do cliente é descartado)
    const unitPrice = getGamePrice(gameType, sorted.length);
    if (!unitPrice || unitPrice <= 0) {
      return res.status(400).json({ error: 'Quantidade de números inválida para esta loteria' });
    }
    const amount = Math.round(unitPrice * contests * 100) / 100;
    // Checagem de saldo ANTES de debitar (era possível criar aposta sem saldo,
    // deixando o saldo negativo).
    if (amount > user.balance) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    // PRÓXIMO concurso da loteria (nunca o passado): o jogo participa do
    // concurso que vem e, com teimosinha, dos N seguintes.
    const nextContest = await getNextContestNumber(gameType);
    const now = new Date().toISOString();
    const usageEntries = Array.from({ length: contests }, (_, i) => ({
      contestNumber: nextContest + i,
      date: now,
      hits: null,
      prize: null,
      matched: false
    }));

    // Jogo no portfólio: usa o existente (gameId) ou cria um novo (source 'bet')
    let game = null;
    if (gameId) {
      game = await db.getGameById(gameId, user.id);
      if (!game) return res.status(404).json({ error: 'Jogo não encontrado' });
      // À prova de manipulação: o jogo vinculado precisa ter EXATAMENTE os
      // mesmos números apostados (o frontend também guarda isso, mas a API
      // não pode confiar no cliente).
      const gameNums = [...(game.numbers || [])].sort((a, b) => a - b);
      if (gameNums.length !== sorted.length || gameNums.some((n, i) => n !== sorted[i])) {
        return res.status(400).json({ error: 'Os números da aposta não correspondem ao jogo selecionado' });
      }
      game.usageHistory = [...(game.usageHistory || []), ...usageEntries];
      game.status = game.status === 'won' ? 'won' : 'used';
      await db.updateGame(game.id, { status: game.status, usageHistory: game.usageHistory });
    } else {
      const cfg = LOTTERY_CONFIGS[gameType] || LOTTERY_CONFIGS.LOTOFACIL;
      game = {
        id: uuidv4(),
        userId: user.id,
        numbers: sorted,
        gameType,
        name: `${cfg.name} · ${sorted.length} números (aposta)`,
        source: 'bet',
        seedVersion: null,
        createdAt: now,
        status: 'used',
        usageHistory: usageEntries,
        poolId: null
      };
      await db.createGame(game);
    }

    const bet = {
      id: uuidv4(), gameType, numbers: sorted, amount,
      date: new Date(), status: 'active', userId: user.id, gameId: game.id
    };
    await db.addBet(bet);
    await db.adjustUserBalance(user.id, -amount);
    await db.addTransaction({
      id: uuidv4(), userId: user.id, type: 'bet', amount: -amount,
      description: contests > 1
        ? `Teimosinha ${gameType} - ${sorted.length} números × ${contests} concursos (${nextContest}-${nextContest + contests - 1})`
        : `Aposta ${gameType} - ${sorted.length} números (concurso ${nextContest})`,
      date: new Date(), status: 'completed'
    });
    await addNotification(user.id, 'bet', contests > 1 ? 'Teimosinha confirmada!' : 'Aposta confirmada!',
      contests > 1
        ? `${contests} concursos (${nextContest}–${nextContest + contests - 1}) com ${sorted.length} números por ${formatBRL(amount)} — a IA confere cada um!`
        : `Aposta de ${sorted.length} números (${LOTTERY_CONFIGS[gameType]?.name || gameType}) no concurso ${nextContest} por ${formatBRL(amount)} — boa sorte!`,
      '/meus-jogos');
    res.json({ success: true, bet, game, amount, contests, nextContest });
  } catch (e) {
    sendError(res, e, 'POST /api/bets');
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
