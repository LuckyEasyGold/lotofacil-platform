/**
 * smoke.test.js — SMOKE TEST COMPLETO.
 *
 * Bota o app inteiro no ar (supertest + Express) e verifica numa passada
 * rápida que NADA está quebrado em nível de rota/página:
 *
 *   1. Páginas públicas respondem 200
 *   2. Páginas protegidas SEM sessão redirecionam para /login
 *   3. APIs protegidas SEM sessão respondem 401
 *   4. TODAS as páginas renderizam 200 com sessão
 *   5. TODAS as APIs principais respondem 200 (sem 500)
 *   6. Fluxos de escrita (depósito → jogo → aposta → bolão → assinatura)
 *   7. Logout encerra a sessão
 *   8. Rota API inexistente responde 404
 *
 * É o teste que um dev roda primeiro (ou em CI) antes de merges/deploys:
 * se o smoke test passa, o app está de pé e as rotas principais respondem.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { registerUser, cleanupTestData, api } from './helpers.js';

const QUINZE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// Páginas protegidas por autenticação (routes/pages.js + /evolucao admin)
const PROTECTED_PAGES = [
  '/', '/apostas', '/carteira', '/boloes', '/simulacao',
  '/resultados', '/perfil', '/meus-jogos', '/configuracoes', '/estatisticas'
];

// APIs GET principais que devem responder 200 com sessão
const CORE_APIS = [
  '/api/auth/me',
  '/api/dashboard',
  '/api/dashboard/lucky-numbers',
  '/api/dashboard/portfolio-insights',
  '/api/wallet',
  '/api/games',
  '/api/games/stats',
  '/api/pools',
  '/api/pools/popular',
  '/api/bets',
  '/api/results/latest',
  '/api/results/history/recent',
  '/api/database/stats',
  '/api/ai/generate?quantity=3',
  '/api/ai/seed',
  '/api/notifications',
  '/api/gamification/level',
  '/api/gamification/achievements',
  '/api/stats/advanced',
  '/api/subscriptions'
];

describe('Smoke test completo', () => {
  afterAll(async () => {
    await cleanupTestData();
  });

  it('páginas públicas respondem 200', async () => {
    for (const path of ['/login', '/register']) {
      const res = await api.get(path);
      expect(res.status, `GET ${path}`).toBe(200);
    }
  });

  it('páginas protegidas SEM sessão redirecionam para /login', async () => {
    for (const path of PROTECTED_PAGES) {
      const res = await api.get(path);
      expect(res.status, `GET ${path} sem sessão`).toBe(302);
      expect(res.headers.location, `redirect de ${path}`).toBe('/login');
    }
  });

  it('APIs protegidas SEM sessão respondem 401', async () => {
    for (const path of ['/api/wallet', '/api/games', '/api/pools', '/api/bets', '/api/dashboard']) {
      const res = await api.get(path);
      expect(res.status, `GET ${path} sem sessão`).toBe(401);
    }
  });

  it('registro cria sessão e /api/auth/me autentica', async () => {
    const { agent } = await registerUser();
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.authenticated).toBe(true);
    expect(me.body.user.password).toBeUndefined(); // hash nunca vaza
  });

  it('TODAS as páginas renderizam 200 com sessão', async () => {
    const { agent } = await registerUser();
    for (const path of PROTECTED_PAGES) {
      const res = await agent.get(path);
      expect(res.status, `GET ${path} com sessão`).toBe(200);
    }
  });

  it('TODAS as APIs principais respondem 200 (sem 500)', async () => {
    const { agent } = await registerUser();
    for (const path of CORE_APIS) {
      const res = await agent.get(path);
      expect(res.status, `GET ${path}`).toBe(200);
    }
  });

  it('PUT /api/profile atualiza o perfil', async () => {
    const { agent } = await registerUser();
    const res = await agent.put('/api/profile').send({ name: 'Nome Atualizado' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.name).toBe('Nome Atualizado');
  });

  it('fluxo de escrita completo: depósito → jogo → aposta → bolão → assinatura', async () => {
    const { agent } = await registerUser();

    // Depósito
    const dep = await agent.post('/api/wallet/deposit').send({ amount: 100 });
    expect(dep.status).toBe(200);
    expect(dep.body.balance).toBe(100);

    // Criação de jogo
    const game = await agent.post('/api/games').send({ gameType: 'LOTOFACIL', numbers: QUINZE, name: 'Smoke' });
    expect(game.status).toBe(200);
    const gameId = game.body.game.id;

    // Aposta (debita da carteira)
    const bet = await agent.post('/api/bets').send({ gameType: 'LOTOFACIL', numbers: QUINZE, amount: 10 });
    expect(bet.status).toBe(200);

    // Criação de bolão (debita 1 cota)
    const pool = await agent.post('/api/pools').send({
      name: 'Bolão Smoke', gameType: 'LOTOFACIL', contestNumber: 3005,
      totalShares: 10, sharePrice: 5, numbers: QUINZE
    });
    expect(pool.status).toBe(200);
    expect(pool.body.pool.availableShares).toBe(9);

    // Entrar no bolão
    const join = await agent.post(`/api/pools/${pool.body.pool.id}/join`).send({ shares: 1 });
    expect(join.status).toBe(200);

    // Assinatura recorrente
    const sub = await agent.post('/api/subscriptions').send({ gameType: 'LOTOFACIL', numbers: QUINZE, interval: 'weekly' });
    expect(sub.status).toBe(200);

    // Saldo final consistente: 100 - 10 (aposta) - 5 (bolão) - 5 (join 1 cota)
    const wallet = await agent.get('/api/wallet');
    expect(wallet.body.balance).toBe(80);
  });

  it('aposta sem saldo é rejeitada (400)', async () => {
    const { agent } = await registerUser(); // saldo 0
    const res = await agent.post('/api/bets').send({ gameType: 'LOTOFACIL', numbers: QUINZE, amount: 10 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insuficiente/i);
  });

  it('criação de bolão sem saldo é rejeitada (400)', async () => {
    const { agent } = await registerUser(); // saldo 0
    const res = await agent.post('/api/pools').send({
      name: 'Sem Saldo', gameType: 'LOTOFACIL', contestNumber: 3005,
      totalShares: 10, sharePrice: 5, numbers: QUINZE
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insuficiente/i);
  });

  it('logout encerra a sessão', async () => {
    const { agent } = await registerUser();
    const out = await agent.post('/api/auth/logout');
    expect(out.status).toBe(200);
    expect(out.body.success).toBe(true);

    const me = await agent.get('/api/auth/me');
    expect(me.body.authenticated).toBe(false);
  });

  it('rota API inexistente responde 404 JSON', async () => {
    const res = await api.get('/api/rota-inexistente');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
