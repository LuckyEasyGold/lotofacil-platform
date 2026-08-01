/**
 * auth.test.js — Testes do fluxo de autenticação.
 * Cobre: registro, validações de cadastro, login (sucesso/erro), sessão,
 * /api/auth/me e logout.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { registerUser, cleanupTestData, api } from './helpers.js';

describe('Auth API', () => {
  afterAll(async () => {
    await cleanupTestData();
  });

  it('registra um usuário novo com sucesso', async () => {
    const { user, email } = await registerUser();
    expect(user.email).toBe(email);
    expect(user.id).toBeTruthy();
    expect(user.password).toBeUndefined(); // nunca expor hash
  });

  it('rejeita cadastro com senha curta', async () => {
    const res = await api.post('/api/auth/register').send({
      name: 'Teste', email: `curto_${Date.now()}@test.com`, password: '123'
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejeita cadastro com email duplicado', async () => {
    const { email } = await registerUser();
    const res = await api.post('/api/auth/register').send({
      name: 'Outro', email, password: 'senha-teste-123'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/já está cadastrado/i);
  });

  it('login com credenciais corretas retorna sessão', async () => {
    const { email, password, agent } = await registerUser();
    // já está logado pelo registro; faz logout e loga de novo
    await agent.post('/api/auth/logout');
    const res = await agent.post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const me = await agent.get('/api/auth/me');
    expect(me.body.authenticated).toBe(true);
    expect(me.body.user.email).toBe(email);
  });

  it('login com senha errada retorna 401', async () => {
    const { email } = await registerUser();
    const res = await api.post('/api/auth/login').send({ email, password: 'senha-errada' });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me sem sessão retorna authenticated:false', async () => {
    const res = await api.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(false);
  });

  it('logout encerra a sessão', async () => {
    const { agent } = await registerUser();
    const out = await agent.post('/api/auth/logout');
    expect(out.body.success).toBe(true);

    const me = await agent.get('/api/auth/me');
    expect(me.body.authenticated).toBe(false);
  });

  it('rota protegida sem sessão retorna 401 (JSON)', async () => {
    const res = await api.get('/api/wallet');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});
