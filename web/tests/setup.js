/**
 * tests/setup.js — Setup global dos testes (roda antes de cada arquivo).
 *
 * O que faz:
 * 1. Define `VERCEL=1` ANTES de importar o server.js — isso faz o módulo
 *    exportar apenas o `app` do Express SEM abrir porta (o `app.listen`
 *    só roda quando VERCEL !== '1'), que é exatamente o que o supertest precisa.
 * 2. Define `NODE_ENV=test` (desativa cookie seguro em HTTP local).
 * 3. Registra um `afterAll` global que fecha o pool do Postgres ao final de
 *    cada arquivo de teste (evita processo pendurado).
 */
process.env.VERCEL = '1';
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret';
process.env.COOKIE_SECURE = 'false';
// Evita chamada externa ao gerador de imagem QR nos testes (a cobrança PIX
// continua válida — só não gera o base64 da imagem).
process.env.PIX_QR_DISABLED = '1';

import { afterAll } from 'vitest';
import db from '../db.js';

afterAll(async () => {
  try { await db.pool.end(); } catch (e) { /* pool já fechado */ }
});
