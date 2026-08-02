/**
 * pools.test.js — Testes de bolões.
 * Cobre: criação, listagem, participação (join) com cotas e validações
 * (cotas insuficientes / saldo insuficiente).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerUser, fundUser, cleanupTestData, db } from './helpers.js';

const NUMEROS_POOL = [1, 2, 5, 6, 9, 10, 11, 12, 15, 17, 18, 19, 21, 24, 25];

// Bolões criados via API não têm user_id (só creator_name) — rastreamos os ids
// para apagá-los no cleanup (senão poluem o banco de teste).
const createdPoolIds = [];

async function criarBolao(agent, overrides = {}) {
  const res = await agent.post('/api/pools').send({
    name: overrides.name || `Bolão Teste ${Date.now()}`,
    gameType: 'LOTOFACIL',
    contestNumber: 3005,
    totalShares: 10,
    sharePrice: 10,
    numbers: NUMEROS_POOL,
    ...overrides
  });
  if (res.body.pool) createdPoolIds.push(res.body.pool.id);
  return res;
}

describe('Pools API', () => {
  let agent;

  beforeAll(async () => {
    const reg = await registerUser();
    agent = reg.agent;
    // credita saldo direto (depósito PIX já confirmado pelo admin)
    await fundUser(reg.user.id, 500);
  });

  afterAll(async () => {
    // apaga os bolões criados pelos testes (e suas ofertas/participantes)
    if (createdPoolIds.length > 0) {
      await db.pool.query('DELETE FROM pools WHERE id = ANY($1)', [createdPoolIds]);
    }
    await cleanupTestData();
  });

  it('cria um bolão (1 cota já reservada pelo criador)', async () => {
    const res = await criarBolao(agent);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pool.totalShares).toBe(10);
    expect(res.body.pool.availableShares).toBe(9);
    expect(res.body.pool.participants).toHaveLength(1);
  });

  it('lista os bolões disponíveis', async () => {
    const res = await agent.get('/api/pools');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('permite entrar em um bolão com cotas e desconta da carteira', async () => {
    const created = await criarBolao(agent);
    const poolId = created.body.pool.id;
    const pre = await agent.get('/api/wallet');

    const join = await agent.post(`/api/pools/${poolId}/join`).send({ shares: 2 });
    expect(join.status).toBe(200);
    expect(join.body.success).toBe(true);
    expect(join.body.pool.availableShares).toBe(7); // 9 - 2

    const pos = await agent.get('/api/wallet');
    expect(pos.body.balance).toBe(pre.body.balance - 20); // 2 cotas x R$10
  });

  it('rejeita entrar com mais cotas do que disponível', async () => {
    const created = await criarBolao(agent, { totalShares: 3 });
    const poolId = created.body.pool.id; // available = 2

    const res = await agent.post(`/api/pools/${poolId}/join`).send({ shares: 99 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insuficientes/i);
  });

  it('rejeita entrar sem saldo', async () => {
    // usuário sem saldo
    const { agent: pobre } = await registerUser();
    const created = await criarBolao(agent);
    const poolId = created.body.pool.id;

    const res = await pobre.post(`/api/pools/${poolId}/join`).send({ shares: 1 });
    expect(res.status).toBe(400);
  });
});
