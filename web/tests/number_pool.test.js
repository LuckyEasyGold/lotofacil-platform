/**
 * number_pool.test.js — Testes unitários do Motor 2 (lib/number_pool.js).
 * Funções PURAS: scores, ranking, split quentes/frios, pool e geração.
 */
import { describe, it, expect } from 'vitest';
import {
  computeScores,
  rankNumbers,
  buildPool,
  generateStructuredGames,
  pickFromPool
} from '../lib/number_pool.js';
import { buildProfile, getActiveStructure } from '../lib/patterns.js';

// Histórico sintético: 400 concursos. Primeiro 200 = números 1-15 sempre
// (soma 120, estrutura uniforme). Resto alterna para exercitar o split.
function makeDraws() {
  const draws = [];
  for (let i = 0; i < 400; i++) {
    if (i % 2 === 0) {
      draws.push([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    } else {
      draws.push([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);
    }
  }
  return draws;
}

describe('computeScores / rankNumbers', () => {
  it('números que aparecem mais têm score maior', () => {
    const draws = makeDraws();
    const scores = computeScores(draws, { windowSize: 100, decay: 0 });
    expect(scores[11]).toBeGreaterThan(0);
    // 11-15 aparecem em 100% dos sorteios da janela (pares e ímpares); 1 só nos pares
    expect(scores[11]).toBeGreaterThan(scores[1]);
    expect(scores[1]).toBeGreaterThan(0);
    const ranked = rankNumbers(scores);
    expect(ranked).toHaveLength(25);
    expect(ranked[0]).toBeGreaterThanOrEqual(1);
    expect(ranked[24]).toBeLessThanOrEqual(25);
  });
  it('sem dados retorna scores zerados sem quebrar', () => {
    const scores = computeScores([], {});
    expect(scores.length).toBe(26);
    expect(rankNumbers(scores)).toHaveLength(25);
  });
});

describe('buildPool (pool de ~20 quentes+frios)', () => {
  it('monta pool com tamanho aprendido e split quentes/frios', () => {
    const draws = makeDraws();
    const pool = buildPool(draws);
    expect(pool.pool.length).toBeGreaterThanOrEqual(15);
    expect(pool.pool.length).toBeLessThanOrEqual(25);
    // todos os números 1..25
    pool.pool.forEach(n => expect(n).toBeGreaterThanOrEqual(1));
    pool.pool.forEach(n => expect(n).toBeLessThanOrEqual(25));
    expect(pool.hotShare).toBeGreaterThan(0);
    expect(pool.hotShare).toBeLessThanOrEqual(1);
  });
});

describe('generateStructuredGames (estrutura + pool)', () => {
  it('gera N jogos de 15 dezenas únicas, ordenadas e dentro do pool', () => {
    const draws = makeDraws();
    const profile = buildProfile(draws);
    const active = getActiveStructure(profile);
    const poolResult = buildPool(draws);
    const games = generateStructuredGames(active, poolResult, { quantity: 10, pickCount: 15 });
    expect(games).toHaveLength(10);
    for (const g of games) {
      expect(g).toHaveLength(15);
      expect(new Set(g).size).toBe(15);
      const sorted = [...g].sort((a, b) => a - b);
      expect(g).toEqual(sorted);
      g.forEach(n => expect(poolResult.pool).toContain(n));
    }
  });
  it('com pool menor que o pickCount retorna vazio (sem travar)', () => {
    const games = generateStructuredGames({ sumBand: [170, 220], oddTarget: 7, maxBlock: 5 }, { pool: [1, 2, 3] }, { quantity: 3, pickCount: 15 });
    expect(games).toEqual([]);
  });
});

describe('pickFromPool (seleção sem repetição)', () => {
  it('seleciona `pickCount` números distintos do pool', () => {
    const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    for (let i = 0; i < 5; i++) {
      const picked = pickFromPool(pool, 15);
      expect(picked).toHaveLength(15);
      expect(new Set(picked).size).toBe(15);
      picked.forEach(n => expect(pool).toContain(n));
    }
  });
});
