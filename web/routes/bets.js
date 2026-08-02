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

const router = asyncRouter();

/** POST /api/bets — Criar aposta (debita da carteira) */
router.post('/api/bets', requireAuth, validate(createBetSchema), async (req, res) => {
  try {
    const { gameType, numbers, gameId } = req.body;
    const user = req.currentUser;
    const sorted = [...numbers].sort((a, b) => a - b);

    // Preço oficial calculado no servidor (o amount do cliente é descartado)
    const amount = getGamePrice(gameType, sorted.length);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Quantidade de números inválida para esta loteria' });
    }
    // Checagem de saldo ANTES de debitar (era possível criar aposta sem saldo,
    // deixando o saldo negativo).
    if (amount > user.balance) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    // Jogo no portfólio: usa o existente (gameId) ou cria um novo (source 'bet')
    let game = null;
    const usageEntry = {
      contestNumber: null,
      date: new Date().toISOString(),
      hits: null,
      prize: null,
      matched: false
    };
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
      // Mesmo tratamento do jogo criado: marca como usado e registra o uso,
      // para o check-result funcionar também em jogos apostados via portfólio.
      // Preserva o status 'won' se o jogo já foi premiado (não rebaixa).
      game.usageHistory = [...(game.usageHistory || []), usageEntry];
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
        createdAt: new Date().toISOString(),
        status: 'used',
        usageHistory: [usageEntry],
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
      description: `Aposta ${gameType} - ${sorted.length} números`,
      date: new Date(), status: 'completed'
    });
    await addNotification(user.id, 'bet', 'Aposta confirmada!',
      `Aposta de ${sorted.length} números (${LOTTERY_CONFIGS[gameType]?.name || gameType}) por ${formatBRL(amount)} — boa sorte!`,
      '/apostas');
    res.json({ success: true, bet, game, amount });
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
