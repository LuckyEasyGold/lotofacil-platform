/**
 * tests/teimosinha_rateio.test.js — Teimosinha (multi-concurso) + rateio de bolão.
 *
 * Cobre as duas regras de negócio novas:
 *  1. TEIMOSINHA: aposta com `contests` (1-30) cobra N × preço e registra o
 *     jogo nos PRÓXIMOS N concursos (verificação automática por concurso).
 *  2. BOLÃO CONFIGURÁVEL: composition [{pickCount, quantity}] → valor total =
 *     soma dos preços de todos os jogos (proporcional à configuração).
 *  3. RATEIO: quando o resultado do concurso vinculado existe, o prêmio é
 *     dividido proporcional às cotas e creditado na carteira de cada
 *     participante; o bolão vira 'archived' com o resultado no histórico.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerUser, cleanupTestData, db } from './helpers.js';

let createdPoolIds = [];

afterAll(async () => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const id of createdPoolIds) {
      await client.query('DELETE FROM pools WHERE id = $1', [id]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    createdPoolIds = [];
  }
  await cleanupTestData();
});

describe('TEIMOSINHA — aposta em N concursos', () => {
  let ctx;
  beforeAll(async () => {
    ctx = await registerUser();
    await db.adjustUserBalance(ctx.user.id, 500);
  });

  it('cobra N × preço e registra o jogo nos próximos N concursos', async () => {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const res = await ctx.agent.post('/api/bets').send({ gameType: 'LOTOFACIL', numbers, contests: 3 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // 3 × R$ 3,50 = R$ 10,50 (preço oficial com override do banco)
    expect(res.body.amount).toBeCloseTo(10.5, 2);
    expect(res.body.contests).toBe(3);
    expect(res.body.nextContest).toBeDefined();
    // O jogo nasce com 3 usos (um por concurso) nos próximos 3 concursos
    expect(res.body.game.usageHistory.length).toBe(3);
    expect(res.body.game.usageHistory[0].contestNumber).toBe(res.body.nextContest);
    expect(res.body.game.usageHistory[1].contestNumber).toBe(res.body.nextContest + 1);
    expect(res.body.game.usageHistory[2].contestNumber).toBe(res.body.nextContest + 2);
    // Saldo debitado: 500 - 10,50
    const me = await db.getUserById(ctx.user.id);
    expect(me.balance).toBeCloseTo(489.5, 2);
  });

  it('aposta simples (contests=1) continua valendo o preço unitário', async () => {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const res = await ctx.agent.post('/api/bets').send({ gameType: 'LOTOFACIL', numbers });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBeCloseTo(3.5, 2);
    expect(res.body.contests).toBe(1);
    expect(res.body.game.usageHistory.length).toBe(1);
  });
});

describe('BOLÃO CONFIGURÁVEL — composição de jogos', () => {
  let ctx;
  let compositionPoolId = null; // bolão de 3 cotas criado no 1º teste (usado no teste de reembolso)
  beforeAll(async () => {
    // Nome ÚNICO: o reembolso do criador usa getUserByName(creatorName) — com
    // nome genérico o LIMIT 1 poderia pegar outro usuário de teste.
    ctx = await registerUser({ name: `Composicao ${Date.now()}` });
    await db.adjustUserBalance(ctx.user.id, 2000);
  });

  it('cria bolão com composição mista e valor proporcional à configuração', async () => {
    // 2 jogos de 15 (R$ 3,50) + 1 jogo de 16 (R$ 56,00) = R$ 63,00 total
    const res = await ctx.agent.post('/api/pools/structured').send({
      name: 'Bolão IA Teste Composição',
      composition: [
        { pickCount: 15, quantity: 2 },
        { pickCount: 16, quantity: 1 }
      ]
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.games.length).toBe(3);
    expect(res.body.totalValue).toBeCloseTo(63, 2);
    expect(res.body.contestNumber).toBeDefined();
    createdPoolIds.push(res.body.pool.id);
    compositionPoolId = res.body.pool.id;

    const pool = await db.getPoolById(res.body.pool.id);
    expect(pool.games.length).toBe(3);
    expect(pool.contestNumber).toBe(res.body.contestNumber);
    // MODELO 1: cotas = nº de jogos (1 cota por jogo); valor por cota = total ÷ cotas
    expect(pool.totalShares).toBe(3);
    expect(pool.sharePrice).toBeCloseTo(21, 2);
    // Custo dos jogos = R$ 63 (pré-financiado pelo criador); taxa = 0
    expect(pool.baseValue).toBeCloseTo(63, 2);
    expect(pool.adminFee).toBe(0);
    // Criador pré-financiou o custo total (não só 1 cota): 2000 - 63
    const me = await db.getUserById(ctx.user.id);
    expect(me.balance).toBeCloseTo(2000 - 63, 2);
  });

  it('cria bolão com taxa administrativa transparente (custo + taxa)', async () => {
    const res = await ctx.agent.post('/api/pools/structured').send({
      name: 'Bolão IA Teste Taxa',
      composition: [{ pickCount: 15, quantity: 10 }],
      adminFee: 20
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Custo dos jogos = 10 × R$ 3,50 = R$ 35; valor total = 35 + 20 = 55
    expect(res.body.baseValue).toBeCloseTo(35, 2);
    expect(res.body.adminFee).toBeCloseTo(20, 2);
    expect(res.body.totalValue).toBeCloseTo(55, 2);
    createdPoolIds.push(res.body.pool.id);

    const pool = await db.getPoolById(res.body.pool.id);
    expect(pool.baseValue).toBeCloseTo(35, 2);
    expect(pool.adminFee).toBeCloseTo(20, 2);
    // 10 cotas (1 por jogo): cota = 55 / 10 = R$ 5,50
    expect(pool.sharePrice).toBeCloseTo(5.5, 2);
  });

  it('reembolsa o criador quando outro participante compra cotas (Modelo 1)', async () => {
    const pool = await db.getPoolById(compositionPoolId); // bolão de 3 cotas
    const creatorBefore = await db.getUserById(ctx.user.id);
    // Outro usuário compra 1 cota → reembolsa o criador em sharePrice
    const buyer = await registerUser();
    await db.adjustUserBalance(buyer.user.id, 500);
    const join = await buyer.agent.post(`/api/pools/${pool.id}/join`).send({ shares: 1 });
    expect(join.status).toBe(200);
    const creatorAfter = await db.getUserById(ctx.user.id);
    expect(creatorAfter.balance).toBeCloseTo(creatorBefore.balance + pool.sharePrice, 2);
  });

  it('rejeita composição vazia', async () => {
    const res = await ctx.agent.post('/api/pools/structured').send({
      name: 'Bolão IA Teste Inválido',
      composition: []
    });
    expect(res.status).toBe(400);
  });
});

describe('RATEIO DO BOLÃO — prêmio automático proporcional às cotas', () => {
  let ctx;
  let poolId;
  beforeAll(async () => {
    ctx = await registerUser({ name: `Rateio ${Date.now()}` });
    await db.adjustUserBalance(ctx.user.id, 2000);
  });

  it('verifica o concurso, divide o rateio e arquiva o bolão', async () => {
    // Bolão determinístico (criado direto no banco): 3 jogos, 1 participante
    // com 1 cota de 3. Concurso fictício 999990 para não colidir com os reais.
    const drawn = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const pool = await db.createPool({
      id: `pool_rateio_${Date.now()}`,
      name: 'Bolão IA Teste Rateio',
      gameType: 'LOTOFACIL',
      contestNumber: 999990,
      totalShares: 3,
      availableShares: 2,
      sharePrice: 3.5,
      minShares: 1,
      maxShares: 1,
      numbers: drawn,
      games: [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // 15 acertos → R$ 924.479,40
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // 15 acertos → R$ 924.479,40
        [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]  // 14 acertos → R$ 1.124,87
      ],
      creatorName: ctx.user.name,
      status: 'open',
      createdAt: new Date(),
      participants: [{ name: ctx.user.name, shares: 1, paid: true }]
    });
    poolId = pool.id;
    createdPoolIds.push(pool.id);
    await db.saveResult({ numero: 999990, listaDezenas: drawn });

    const before = await db.getUserById(ctx.user.id);
    const res = await ctx.agent.post(`/api/pools/${pool.id}/check-result`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Prêmio total: 924.479,40 × 2 + 1.124,87 = 1.850.083,67
    expect(res.body.totalPrize).toBeCloseTo(1850083.67, 2);

    // Rateio soma = prêmio total. O participante É o criador (1 cota própria +
    // 2 cotas não vendidas, que pertencem ao criador do bolão) → recebe tudo.
    const rateioSum = res.body.rateio.reduce((s, r) => s + r.amount, 0);
    expect(rateioSum).toBeCloseTo(res.body.totalPrize, 1);
    expect(res.body.rateio[0].name).toBe(ctx.user.name);
    expect(res.body.rateio[0].amount).toBeCloseTo(1850083.67, 1);

    // Crédito automático na carteira do participante (prêmio integral)
    const after = await db.getUserById(ctx.user.id);
    expect(after.balance).toBeCloseTo(before.balance + 1850083.67, 1);

    // Bolão arquivado com o resultado no histórico
    const archived = await db.getPoolById(pool.id);
    expect(archived.status).toBe('archived');
    expect(archived.results.length).toBe(1);
    expect(archived.results[0].contestNumber).toBe(999990);
    expect(archived.results[0].games.length).toBe(3);
  });

  it('bolão já verificado não processa de novo (idempotente)', async () => {
    const before = await db.getUserById(ctx.user.id);
    const res = await ctx.agent.post(`/api/pools/${poolId}/check-result`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.alreadyChecked).toBe(true);
    const after = await db.getUserById(ctx.user.id);
    expect(after.balance).toBeCloseTo(before.balance, 2); // sem crédito duplicado
  });
});
