/**
 * games.test.js — Testes do portfólio de jogos.
 * Cobre: criação com validações (quantidade, range, duplicados), listagem,
 * stats, duplicação, marcar como usado e check-result contra o último sorteio.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerUser, cleanupTestData } from './helpers.js';

const QUINZE_NUMEROS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

describe('Games API', () => {
  let agent;

  beforeAll(async () => {
    ({ agent } = await registerUser());
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('cria um jogo válido de Lotofácil (15 números)', async () => {
    const res = await agent.post('/api/games').send({
      gameType: 'LOTOFACIL', numbers: QUINZE_NUMEROS, name: 'Meu Jogo'
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.game.numbers).toHaveLength(15);
  });

  it('rejeita jogo com quantidade errada de números', async () => {
    const res = await agent.post('/api/games').send({
      gameType: 'LOTOFACIL', numbers: [1, 2, 3]
    });
    expect(res.status).toBe(400);
  });

  it('rejeita números fora do range 1-25', async () => {
    const res = await agent.post('/api/games').send({
      gameType: 'LOTOFACIL', numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 99]
    });
    expect(res.status).toBe(400);
  });

  it('rejeita números duplicados', async () => {
    const res = await agent.post('/api/games').send({
      gameType: 'LOTOFACIL', numbers: [1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
    });
    expect(res.status).toBe(400);
  });

  it('lista os jogos do usuário com stats', async () => {
    const list = await agent.get('/api/games');
    expect(list.status).toBe(200);
    expect(list.body.total).toBeGreaterThan(0);

    const stats = await agent.get('/api/games/stats');
    expect(stats.body.total).toBe(list.body.total);
  });

  it('duplica um jogo', async () => {
    const created = await agent.post('/api/games').send({
      gameType: 'LOTOFACIL', numbers: QUINZE_NUMEROS, name: 'Original'
    });
    const gameId = created.body.game.id;

    const dup = await agent.post(`/api/games/${gameId}/duplicate`);
    expect(dup.status).toBe(200);
    expect(dup.body.game.name).toMatch(/cópia/i);
    expect(dup.body.game.id).not.toBe(gameId);
  });

  it('marca um jogo como usado em um concurso', async () => {
    const created = await agent.post('/api/games').send({
      gameType: 'LOTOFACIL', numbers: QUINZE_NUMEROS, name: 'Usar'
    });
    const gameId = created.body.game.id;

    const res = await agent.post(`/api/games/${gameId}/use`).send({ contestNumber: 3000 });
    expect(res.status).toBe(200);
    expect(res.body.game.status).toBe('used');
    expect(res.body.game.usageHistory).toHaveLength(1);
  });

  it('check-result avalia o jogo contra o último sorteio', async () => {
    const created = await agent.post('/api/games').send({
      gameType: 'LOTOFACIL', numbers: QUINZE_NUMEROS, name: 'Checar'
    });
    const gameId = created.body.game.id;

    const res = await agent.post(`/api/games/${gameId}/check-result`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result).toBeDefined();
    expect(Array.isArray(res.body.result.drawnNumbers)).toBe(true);
    expect(typeof res.body.result.hits).toBe('number');
  });

  it('DELETE de jogo sem uso remove permanentemente', async () => {
    const created = await agent.post('/api/games').send({
      gameType: 'LOTOFACIL', numbers: QUINZE_NUMEROS, name: 'Deletar'
    });
    const gameId = created.body.game.id;

    const res = await agent.delete(`/api/games/${gameId}`);
    expect(res.status).toBe(200);

    const list = await agent.get('/api/games');
    expect(list.body.games.find(g => g.id === gameId)).toBeUndefined();
  });
});
