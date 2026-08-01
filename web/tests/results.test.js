/**
 * results.test.js — Testes dos endpoints de resultados.
 * Cobre: último resultado, histórico recente, busca por concurso,
 * autenticação obrigatória e erro para concurso inexistente.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerUser, cleanupTestData, api } from './helpers.js';

describe('Results API', () => {
  let agent;

  beforeAll(async () => {
    ({ agent } = await registerUser());
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('exige autenticação (401 sem sessão)', async () => {
    const res = await api.get('/api/results/latest');
    expect(res.status).toBe(401);
  });

  it('retorna o último resultado com dezenas', async () => {
    const res = await agent.get('/api/results/latest');
    expect(res.status).toBe(200);
    expect(res.body.numero).toBeGreaterThan(0);
    expect(res.body.listaDezenas).toHaveLength(15);
  }, 60000);

  it('retorna histórico recente (limit 5)', async () => {
    const res = await agent.get('/api/results/history/recent?limit=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeLessThanOrEqual(5);
    if (res.body.length > 0) {
      expect(res.body[0].listaDezenas).toHaveLength(15);
    }
  });

  it('busca o concurso mais antigo disponível', async () => {
    const stats = await agent.get('/api/database/stats');
    const first = stats.body.first;
    const res = await agent.get(`/api/results/${first}`);
    expect(res.status).toBe(200);
    expect(res.body.numero).toBe(first);
    expect(res.body.listaDezenas).toHaveLength(15);
  });

  it('retorna erro para concurso inexistente', async () => {
    const res = await agent.get('/api/results/99999999');
    expect(res.status).toBe(200);
    expect(res.body.error).toBeDefined();
  });

  it('stats do banco mostram o total de concursos', async () => {
    const res = await agent.get('/api/database/stats');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.last).toBeGreaterThan(0);
  });
});
