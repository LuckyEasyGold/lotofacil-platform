/**
 * ai.test.js — Testes dos endpoints de IA.
 * Cobre: geração de jogos, simulação, semente, números da sorte do dia
 * e proteção de rotas de admin (evolução).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerUser, cleanupTestData, api } from './helpers.js';

const QUINZE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

describe('AI API', () => {
  let agent;

  beforeAll(async () => {
    ({ agent } = await registerUser());
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('gera jogos com a IA (quantidade pedida, 15 números únicos cada)', async () => {
    const res = await agent.get('/api/ai/generate?quantity=3');
    expect(res.status).toBe(200);
    expect(res.body.game_type).toBe('LOTOFACIL');
    expect(res.body.games).toHaveLength(3);
    for (const g of res.body.games) {
      expect(g).toHaveLength(15);
      expect(new Set(g).size).toBe(15);
      g.forEach(n => expect(n).toBeGreaterThanOrEqual(1));
      g.forEach(n => expect(n).toBeLessThanOrEqual(25));
    }
  });

  it('simulação com 15 números retorna resultado completo', async () => {
    const res = await agent.post('/api/simulate').send({ numbers: QUINZE });
    expect(res.status).toBe(200);
    expect(res.body.numbers).toHaveLength(15);
    expect(typeof res.body.totalHits).toBe('number');
    expect(typeof res.body.bestHit).toBe('number');
    expect(res.body.results).toHaveLength(50);
    expect(res.body.hitRate).toBeDefined();
  });

  it('simulação com quantidade errada de números retorna 400', async () => {
    const res = await agent.post('/api/simulate').send({ numbers: [1, 2, 3] });
    expect(res.status).toBe(400);
  });

  it('retorna a semente atual da IA', async () => {
    const res = await agent.get('/api/ai/seed');
    expect(res.status).toBe(200);
    expect(res.body.game_type).toBe('LOTOFACIL');
    expect(res.body.weights).toHaveLength(25);
    expect(res.body.generation).toBeGreaterThanOrEqual(0);
  });

  it('números da sorte do dia têm 15 números válidos', async () => {
    const res = await agent.get('/api/dashboard/lucky-numbers');
    expect(res.status).toBe(200);
    expect(res.body.luckyNumbers).toHaveLength(15);
    expect(res.body.hotNumbers.length).toBeGreaterThan(0);
    res.body.luckyNumbers.forEach(n => {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(25);
    });
  });

  it('exige autenticação em /api/ai/generate', async () => {
    const res = await api.get('/api/ai/generate');
    expect(res.status).toBe(401);
  });

  it('evolução exige perfil admin (403 para usuário comum)', async () => {
    const res = await agent.post('/api/ai/evolve').send({ generations: 5 });
    expect(res.status).toBe(403);
  });

  it('histórico de evolução exige admin (403 para usuário comum)', async () => {
    const res = await agent.get('/api/ai/evolution-history');
    expect(res.status).toBe(403);
  });
});
