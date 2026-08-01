/**
 * vitest.config.js — Configuração do Vitest (testes de API com supertest).
 *
 * Notas:
 * - `environment: 'node'` — não precisamos de DOM (são testes de HTTP).
 * - `setupFiles` roda ANTES de cada arquivo de teste (define env de teste e
 *   registra teardown global do pool do Postgres).
 * - `fileParallelism: false` + `maxWorkers: 1` — roda os arquivos em sequência
 *   para não concorrer por conexões/estado compartilhado no banco de teste.
 * - `testTimeout` alto porque o bootstrap do server.js conecta no Postgres
 *   (Neon) e carrega o cache de resultados no primeiro request.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 30000,
    clearMocks: true,
    // singleFork: roda todos os arquivos no MESMO processo filho (sem custo
    // de spawn por arquivo — importante porque cada arquivo reimporta o
    // server.js e roda o bootstrap). isolate continua ativo por arquivo.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } }
  }
});
