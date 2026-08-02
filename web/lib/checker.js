/**
 * lib/checker.js — Verificação automática de resultados (cron diário).
 *
 * Todo dia o sistema avalia se os jogos e bolões dos usuários foram premiados:
 *  - JOGOS (teimosinha): cada entrada do usageHistory tem um contestNumber.
 *    Quando o resultado daquele concurso existe, calcula acertos e crédita o
 *    prêmio na carteira de quem acertou (transação + notificação).
 *  - BOLÕES: quando o resultado do concurso vinculado existe, calcula acertos
 *    de CADA jogo do bolão, soma os prêmios e divide o rateio PROPORCIONAL às
 *    cotas de cada participante, creditando nas carteiras. O bolão vira
 *    'archived' com o resultado salvo em `results`.
 *
 * Chamado pelo Vercel Cron (routes/subscriptions.js → /api/cron/process-subscriptions)
 * e também pode ser acionado manualmente (botão "Verificar" na UI).
 */
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { PRIZE_TABLES } = require('./lottery');
const { fetchResultByContestAndType, fetchLatestResultByGameType } = require('./context');
const { addNotification } = require('./notifications');
const { formatBRL } = require('./format');
const { checkAchievements } = require('./gamification');

function round2(v) { return Math.round(v * 100) / 100; }

/**
 * Verifica um JOGO contra os resultados dos concursos em que ele participa.
 * @param {object} game — jogo do portfólio (com usageHistory)
 * @returns {{ checked: number, totalPrize: number, won: boolean, contests: object[] }}
 */
async function checkGame(game) {
  const history = game.usageHistory || [];
  const contests = [];
  let totalPrize = 0;

  // Jogo nunca registrado em concurso: avalia contra o último sorteio (legado,
  // sem crédito — o jogo só recebe prêmio quando participa via aposta/uso).
  if (history.length === 0) {
    const latest = await fetchLatestResultByGameType(game.gameType);
    if (latest && latest.listaDezenas) {
      const drawn = new Set(latest.listaDezenas.map(n => parseInt(n, 10)));
      const hits = (game.numbers || []).filter(n => drawn.has(n)).length;
      const prizeTable = PRIZE_TABLES[game.gameType] || PRIZE_TABLES.LOTOFACIL;
      const prize = prizeTable[hits] || 0;
      contests.push({
        contestNumber: latest.numero || null,
        hits, prize,
        drawnNumbers: [...drawn].sort((a, b) => a - b),
        legacy: true
      });
    }
    return { checked: contests.length, totalPrize: 0, won: false, contests };
  }

  for (const entry of history) {
    // Já verificado (hits preenchido) → pula
    if (entry.hits !== null && entry.hits !== undefined) continue;

    const result = entry.contestNumber
      ? await fetchResultByContestAndType(game.gameType, entry.contestNumber)
      : await fetchLatestResultByGameType(game.gameType);
    if (!result || !result.listaDezenas) continue; // resultado ainda não saiu
    if (entry.contestNumber == null && result.numero) entry.contestNumber = result.numero;

    const drawn = new Set(result.listaDezenas.map(n => parseInt(n, 10)));
    const hits = (game.numbers || []).filter(n => drawn.has(n)).length;
    const prizeTable = PRIZE_TABLES[game.gameType] || PRIZE_TABLES.LOTOFACIL;
    const prize = prizeTable[hits] || 0;

    entry.hits = hits;
    entry.prize = prize;
    entry.matched = prize > 0;
    totalPrize += prize;
    contests.push({ contestNumber: entry.contestNumber, hits, prize, drawnNumbers: [...drawn].sort((a, b) => a - b) });
  }

  if (contests.length === 0) return { checked: 0, totalPrize: 0, won: game.status === 'won', contests };

  const won = totalPrize > 0;
  if (won) game.status = 'won';
  await db.updateGame(game.id, { status: game.status, usageHistory: history });

  if (won) {
    await db.adjustUserBalance(game.userId, totalPrize);
    await db.adjustUserWinnings(game.userId, totalPrize);
    await db.addTransaction({
      id: uuidv4(), userId: game.userId, type: 'prize', amount: round2(totalPrize),
      description: `🏆 Prêmio de "${game.name}" (${contests.map(c => c.hits).join('/')} acertos)`,
      date: new Date(), status: 'completed'
    });
    await addNotification(game.userId, 'prize', 'Jogo premiado!',
      `"${game.name}" acertou e rendeu ${formatBRL(round2(totalPrize))} — já está na sua carteira!`,
      '/meus-jogos');
    await checkAchievements(game.userId); // conquistas (ex.: win_first, hit_15)
  }

  return { checked: contests.length, totalPrize: round2(totalPrize), won, contests };
}

/**
 * Verifica um BOLÃO contra o resultado do concurso vinculado e faz o rateio.
 * @param {object} pool — bolão (games, contestNumber, participants, totalShares)
 * @returns {{ checked: boolean, totalPrize: number, games: object[], rateio: object[], reason?: string }}
 */
async function checkPool(pool) {
  if (!pool || !pool.contestNumber) {
    return { checked: false, totalPrize: 0, games: [], rateio: [], reason: 'sem-concurso' };
  }
  if ((pool.games || []).length === 0) {
    return { checked: false, totalPrize: 0, games: [], rateio: [], reason: 'sem-jogos' };
  }
  // Já verificado/arquivado → não processa de novo
  if (pool.status === 'archived' || (pool.results || []).length > 0) {
    return { checked: false, totalPrize: 0, games: [], rateio: [], reason: 'ja-verificado' };
  }

  const result = await fetchResultByContestAndType(pool.gameType, pool.contestNumber);
  if (!result || !result.listaDezenas) {
    return { checked: false, totalPrize: 0, games: [], rateio: [], reason: 'sem-resultado' };
  }

  const drawn = new Set(result.listaDezenas.map(n => parseInt(n, 10)));
  const prizeTable = PRIZE_TABLES[pool.gameType] || PRIZE_TABLES.LOTOFACIL;

  const gamesResult = (pool.games || []).map(g => {
    const hits = (g || []).filter(n => drawn.has(n)).length;
    return { hits, prize: prizeTable[hits] || 0 };
  });
  const totalPrize = round2(gamesResult.reduce((s, g) => s + g.prize, 0));
  const totalShares = pool.totalShares || pool.participants.reduce((s, p) => s + (p.shares || 0), 0) || 1;

  // Rateio PROPORCIONAL às cotas de cada participante. Cotas NÃO VENDIDAS
  // (totalShares - cotas vendidas) pertencem ao CRIADOR do bolão, que recebe
  // o prêmio proporcional delas (regra padrão de "vaquinha"). Entradas do
  // mesmo usuário são somadas para creditar 1x só na carteira.
  const rateioMap = new Map();
  for (const p of pool.participants || []) {
    const amount = round2(totalPrize * (p.shares || 0) / totalShares);
    if (amount <= 0) continue;
    const prev = rateioMap.get(p.name);
    rateioMap.set(p.name, {
      shares: (prev?.shares || 0) + (p.shares || 0),
      amount: round2((prev?.amount || 0) + amount)
    });
  }
  const soldShares = (pool.participants || []).reduce((s, p) => s + (p.shares || 0), 0);
  const unsold = Math.max(totalShares - soldShares, 0);
  if (unsold > 0 && pool.creatorName) {
    const amount = round2(totalPrize * unsold / totalShares);
    const prev = rateioMap.get(pool.creatorName);
    rateioMap.set(pool.creatorName, {
      shares: (prev?.shares || 0) + unsold,
      amount: round2((prev?.amount || 0) + amount)
    });
  }
  const rateio = [...rateioMap.entries()].map(([name, v]) => ({ name, shares: v.shares, amount: v.amount }));

  // Credita automaticamente na carteira de cada participante (1x por usuário)
  for (const r of rateio) {
    const user = await db.getUserByName(r.name);
    if (!user) continue;
    await db.adjustUserBalance(user.id, r.amount);
    await db.adjustUserWinnings(user.id, r.amount);
    await db.addTransaction({
      id: uuidv4(), userId: user.id, type: 'prize', amount: r.amount,
      description: `🏆 Rateio do bolão "${pool.name}" (concurso #${pool.contestNumber})`,
      date: new Date(), status: 'completed'
    });
    await addNotification(user.id, 'prize', 'Bolão premiado!',
      `O bolão "${pool.name}" (concurso #${pool.contestNumber}) rendeu ${formatBRL(r.amount)} para você!`,
      '/boloes');
    await checkAchievements(user.id); // conquistas (ex.: pool_first, win_first)
  }

  // Arquiva com o resultado completo no histórico
  const resultsEntry = {
    contestNumber: pool.contestNumber,
    drawnNumbers: [...drawn].sort((a, b) => a - b),
    games: gamesResult,
    totalPrize,
    rateio,
    checkedAt: new Date().toISOString()
  };
  await db.updatePool(pool.id, { status: 'archived', results: [...(pool.results || []), resultsEntry] });

  return { checked: true, totalPrize, games: gamesResult, rateio, reason: null };
}

/** Varredura diária: TODOS os jogos com verificações pendentes. */
async function checkAllGames() {
  const games = await db.getAllGames();
  let checked = 0, prizeTotal = 0;
  for (const game of games) {
    if ((game.usageHistory || []).length === 0) continue; // sem concursos registrados
    try {
      const r = await checkGame(game);
      checked += r.checked;
      prizeTotal += r.totalPrize;
    } catch (e) {
      console.error('⚠️ Erro ao verificar jogo', game.id, e.message);
    }
  }
  return { games: games.length, checked, prizeTotal: round2(prizeTotal) };
}

/** Varredura diária: TODOS os bolões com concurso vinculado. */
async function checkAllPools() {
  const pools = await db.getPools();
  let checked = 0, prizeTotal = 0;
  for (const pool of pools) {
    try {
      if (pool.status === 'archived' || (pool.results || []).length > 0) continue;
      const r = await checkPool(pool);
      if (r.checked) { checked++; prizeTotal += r.totalPrize; }
    } catch (e) {
      console.error('⚠️ Erro ao verificar bolão', pool.id, e.message);
    }
  }
  return { pools: pools.length, checked, prizeTotal: round2(prizeTotal) };
}

module.exports = { checkGame, checkPool, checkAllGames, checkAllPools };
