/**
 * structured_ai.test.js — Testes da IA ESTRUTURAL (2 motores).
 * Cobre: perfil estrutural, geração estruturada e bolão estruturado com IA.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerUser, fundUser, cleanupTestData } from './helpers.js';

describe('IA Estrutural (Motor 1 + Motor 2)', () => {
  let agent;
  let user;

  beforeAll(async () => {
    const reg = await registerUser();
    agent = reg.agent;
    user = reg.user;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('GET /api/ai/structure-profile retorna estrutura em vigor + pool + tabela teórica', async () => {
    const res = await agent.get('/api/ai/structure-profile');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.contests).toBeGreaterThan(0);
    expect(res.body.structure).toBeDefined();
    expect(res.body.structure.sumBand).toHaveLength(2);
    expect(res.body.hot).toHaveLength(5);
    expect(res.body.cold).toHaveLength(5);
    expect(res.body.pool.length).toBeGreaterThanOrEqual(15);
    expect(res.body.probabilityTable).toHaveLength(6);
    expect(res.body.anomalies).toBeDefined();
    expect(res.body.theoretical).toBeDefined();
  });

  it('POST /api/ai/structured-generate gera N jogos na estrutura ativa com preços', async () => {
    const res = await agent.post('/api/ai/structured-generate').send({ quantity: 5, pickCount: 15 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.games).toHaveLength(5);
    for (const g of res.body.games) {
      expect(g).toHaveLength(15);
      expect(new Set(g).size).toBe(15);
      g.forEach(n => expect(n).toBeGreaterThanOrEqual(1));
      g.forEach(n => expect(n).toBeLessThanOrEqual(25));
    }
    expect(res.body.perGamePrice).toBe(3.5);
    expect(res.body.totalPrice).toBe(17.5);
    expect(res.body.structure).toBeDefined();
  });

  it('POST /api/ai/structured-generate valida quantidade (1-20) e dezenas (15-20)', async () => {
    const bad1 = await agent.post('/api/ai/structured-generate').send({ quantity: 0 });
    expect(bad1.status).toBe(400);
    const bad2 = await agent.post('/api/ai/structured-generate').send({ quantity: 5, pickCount: 14 });
    expect(bad2.status).toBe(400);
    const bad3 = await agent.post('/api/ai/structured-generate').send({ quantity: 99 });
    expect(bad3.status).toBe(400);
  });

  it('POST /api/pools/structured cria bolão com N jogos gerados pela IA e 1 cota', async () => {
    // Usuário de teste nasce sem saldo; credita direto (depósito PIX confirmado)
    await fundUser(user.id, 100);
    const res = await agent.post('/api/pools/structured').send({
      name: 'Bolão IA Teste',
      quantity: 3,
      pickCount: 15,
      sharePrice: 3.5
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.games).toHaveLength(3);
    expect(res.body.pool.games).toHaveLength(3);
    expect(res.body.pool.games[0]).toHaveLength(15);
    expect(res.body.pool.gameType).toBe('LOTOFACIL');
    expect(res.body.pool.totalShares).toBe(3);
    expect(res.body.pool.sharePrice).toBe(3.5);
  });

  it('POST /api/pools/structured exige nome válido (400)', async () => {
    const res = await agent.post('/api/pools/structured').send({ name: '', quantity: 3 });
    expect(res.status).toBe(400);
  });
});
