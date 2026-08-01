/**
 * wallet.test.js — Testes da carteira digital.
 * Cobre: saldo inicial, depósito, saque válido, saque sem saldo e histórico.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerUser, cleanupTestData } from './helpers.js';

describe('Wallet API', () => {
  let agent;

  beforeAll(async () => {
    ({ agent } = await registerUser());
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('novo usuário começa com saldo 0 e bônus de boas-vindas', async () => {
    const res = await agent.get('/api/wallet');
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(0);
    expect(res.body.bonusBalance).toBe(50);
  });

  it('depósito aumenta o saldo e registra transação', async () => {
    const res = await agent.post('/api/wallet/deposit').send({ amount: 100, method: 'PIX' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.balance).toBe(100);
    expect(res.body.transaction.type).toBe('deposit');
  });

  it('depósito com valor inválido retorna 400', async () => {
    const res = await agent.post('/api/wallet/deposit').send({ amount: -50 });
    expect(res.status).toBe(400);
  });

  it('saque válido desconta do saldo com status pending', async () => {
    const res = await agent.post('/api/wallet/withdraw').send({ amount: 30 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.balance).toBe(70);
    expect(res.body.transaction.status).toBe('pending');
  });

  it('saque acima do saldo retorna 400', async () => {
    const res = await agent.post('/api/wallet/withdraw').send({ amount: 10000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insuficiente/i);
  });

  it('histórico de transações lista as operações', async () => {
    const res = await agent.get('/api/wallet');
    expect(res.body.transactions.length).toBeGreaterThanOrEqual(2);
    const types = res.body.transactions.map(t => t.type);
    expect(types).toContain('deposit');
    expect(types).toContain('withdrawal');
  });
});
