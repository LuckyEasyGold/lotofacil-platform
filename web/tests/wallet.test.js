/**
 * wallet.test.js — Testes da carteira digital com RECEBIMENTO REAL via PIX.
 * Cobre: saldo inicial, depósito PIX (cria cobrança pending, NÃO credita),
 * confirmação do admin, saque com chave PIX, dados bancários e histórico.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerUser, registerAdmin, fundUser, cleanupTestData } from './helpers.js';

describe('Wallet API (PIX real)', () => {
  let agent;
  let user;

  beforeAll(async () => {
    ({ agent, user } = await registerUser());
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

  it('depósito PIX gera cobrança pendente e NÃO credita saldo na hora', async () => {
    const res = await agent.post('/api/wallet/deposit').send({ amount: 100 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pixCharge).toBeDefined();
    expect(res.body.pixCharge.status).toBe('pending');
    expect(res.body.pixCharge.qrCode).toMatch(/^000201/); // BR Code PIX
    expect(res.body.pixCharge.txid).toBeDefined();
    // Saldo NÃO muda (depósito só é creditado após o admin confirmar)
    const wallet = await agent.get('/api/wallet');
    expect(wallet.body.balance).toBe(0);
  });

  it('depósito com valor inválido retorna 400', async () => {
    const res = await agent.post('/api/wallet/deposit').send({ amount: -50 });
    expect(res.status).toBe(400);
    const res2 = await agent.post('/api/wallet/deposit').send({ amount: 0 });
    expect(res2.status).toBe(400);
  });

  it('listar depósitos PIX retorna a cobrança criada', async () => {
    const res = await agent.get('/api/wallet/deposits');
    expect(res.status).toBe(200);
    expect(res.body.deposits.length).toBeGreaterThanOrEqual(1);
    expect(res.body.deposits[0].status).toBe('pending');
  });

  it('admin confirma o depósito PIX e o saldo é creditado', async () => {
    const created = await agent.post('/api/wallet/deposit').send({ amount: 200 });
    const chargeId = created.body.pixCharge.id;

    // Usuário comum NÃO pode confirmar (403)
    const denied = await agent.post(`/api/wallet/deposit/${chargeId}/confirm`);
    expect(denied.status).toBe(403);

    const { agent: adminAgent } = await registerAdmin();
    const res = await adminAgent.post(`/api/wallet/deposit/${chargeId}/confirm`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.balance).toBe(200);

    // Confirmação duplicada é rejeitada (409)
    const dup = await adminAgent.post(`/api/wallet/deposit/${chargeId}/confirm`);
    expect(dup.status).toBe(409);
  });

  it('admin cancela depósito PIX pendente (sem creditar)', async () => {
    const created = await agent.post('/api/wallet/deposit').send({ amount: 50 });
    const chargeId = created.body.pixCharge.id;
    const { agent: adminAgent } = await registerAdmin();

    const res = await adminAgent.post(`/api/wallet/deposit/${chargeId}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const wallet = await agent.get('/api/wallet');
    expect(wallet.body.balance).toBe(200); // inalterado
  });

  it('cadastro de dados bancários (chave PIX) para saque', async () => {
    const res = await agent.post('/api/wallet/bank-details').send({ chavePix: '99988877766' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.bankDetail.chavePix).toBe('99988877766');

    const list = await agent.get('/api/wallet/bank-details');
    expect(list.body.bankDetails.length).toBe(1);
  });

  it('dado bancário sem chave PIX é rejeitado (400)', async () => {
    const res = await agent.post('/api/wallet/bank-details').send({ bancoNome: 'Nubank' });
    expect(res.status).toBe(400);
  });

  it('saque válido para chave PIX desconta saldo e fica pending', async () => {
    // Funda saldo direto (como um depósito já confirmado)
    await fundUser(user.id, 100);
    const res = await agent.post('/api/wallet/withdraw').send({ amount: 30, chavePix: '99988877766' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.balance).toBeCloseTo(270, 2); // 200 + 100 - 30
    expect(res.body.transaction.status).toBe('pending');
  });

  it('saque sem chave PIX nem dado bancário é rejeitado (400)', async () => {
    const res = await agent.post('/api/wallet/withdraw').send({ amount: 10 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/chave PIX/i);
  });

  it('saque acima do saldo retorna 400', async () => {
    const res = await agent.post('/api/wallet/withdraw').send({ amount: 100000, chavePix: '99988877766' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insuficiente/i);
  });

  it('admin confirma saque (transação pending → completed)', async () => {
    const { agent: adminAgent } = await registerAdmin();
    const before = await agent.get('/api/wallet');
    const pendingWithdraw = before.body.transactions.find(t => t.type === 'withdrawal' && t.status === 'pending');
    expect(pendingWithdraw).toBeDefined();

    const res = await adminAgent.post(`/api/wallet/withdraw/${pendingWithdraw.id}/confirm`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const after = await agent.get('/api/wallet');
    const updated = after.body.transactions.find(t => t.id === pendingWithdraw.id);
    expect(updated.status).toBe('completed');
    // Saldo não muda ao confirmar (já foi debitado na solicitação)
    expect(after.body.balance).toBeCloseTo(before.body.balance, 2);
  });

  it('admin cancela saque e o valor é estornado', async () => {
    const { agent: adminAgent } = await registerAdmin();
    await agent.post('/api/wallet/withdraw').send({ amount: 20, chavePix: '99988877766' });
    const before = await agent.get('/api/wallet');
    const pendingWithdraw = before.body.transactions.find(t => t.type === 'withdrawal' && t.status === 'pending');
    expect(pendingWithdraw).toBeDefined();

    const res = await adminAgent.post(`/api/wallet/withdraw/${pendingWithdraw.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const after = await agent.get('/api/wallet');
    // Estorno: 20 devolvidos à carteira
    expect(after.body.balance).toBeCloseTo(before.body.balance + 20, 2);
    const updated = after.body.transactions.find(t => t.id === pendingWithdraw.id);
    expect(updated.status).toBe('failed');
  });

  it('filtrar transações por tipo funciona', async () => {
    const res = await agent.get('/api/wallet');
    expect(res.body.transactions.length).toBeGreaterThanOrEqual(2);
    const types = res.body.transactions.map(t => t.type);
    expect(types).toContain('deposit');
    expect(types).toContain('withdrawal');
  });
});
