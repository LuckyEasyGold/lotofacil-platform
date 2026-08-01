/**
 * tests/helpers.js — Helpers compartilhados da suíte de testes.
 *
 * - `registerUser()`: cria um usuário ÚNICO por teste (email com timestamp) e
 *   retorna um agente supertest já autenticado + as credenciais.
 * - `cleanupTestData()`: apaga todos os usuários criados pelos testes e seus
 *   dados dependentes (games, transactions, bets, notifications, subs, conquistas).
 *
 * ⚠️ Os testes rodam contra o banco configurado em DATABASE_URL (via .env.local).
 * Para não poluir dados reais, SEMPRE use `registerUser()` + `cleanupTestData()`
 * em afterAll. NUNCA crie usuários com emails fixos.
 */
import request from 'supertest';
import app from '../server.js';
import db from '../db.js';

const createdUserIds = [];

/** Cria um usuário único e retorna agente autenticado + credenciais. */
export async function registerUser(overrides = {}) {
  const email = overrides.email || `vitest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@test.com`;
  const password = overrides.password || 'senha-teste-123';
  const payload = { name: overrides.name || 'Usuário Teste', email, password };

  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send(payload);
  if (res.status !== 200 || !res.body.success) {
    throw new Error(`Falha ao registrar usuário de teste: HTTP ${res.status} ${JSON.stringify(res.body)}`);
  }
  createdUserIds.push(res.body.user.id);
  return { agent, user: res.body.user, email, password };
}

/** Apaga os dados de teste criados nesta execução. */
export async function cleanupTestData() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const id of createdUserIds) {
      for (const table of ['games', 'transactions', 'bets', 'notifications', 'subscriptions', 'user_achievements']) {
        await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [id]);
      }
      await client.query('DELETE FROM users WHERE id = $1', [id]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    createdUserIds.length = 0;
  }
}

/** Cliente supertest SEM sessão (para rotas públicas / testes de 401). */
export const api = request(app);

export { app, db };
