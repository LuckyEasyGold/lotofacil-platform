/**
 * patterns.test.js — Testes unitários do Motor 1 (lib/patterns.js).
 * Funções PURAS: não tocam banco nem HTTP — só matemática da estrutura.
 */
import { describe, it, expect } from 'vitest';
import {
  combination,
  theoreticalPAtLeast,
  getTheoreticalTable,
  extractStructure,
  buildProfile,
  getActiveStructure,
  detectAnomalies,
  theoreticalSumBandFraction
} from '../lib/patterns.js';

// Um sorteio conhecido: 1..15 → soma 120, 15 ímpares consecutivos? Não: pares 2,4,6,8,10,12,14 = 7 pares, 8 ímpares.
const DRAWN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

describe('combination (combinatória)', () => {
  it('calcula C(25,15) = 3.268.760 (total de combinações da Lotofácil)', () => {
    expect(combination(25, 15)).toBe(3268760);
  });
  it('casos triviais', () => {
    expect(combination(5, 0)).toBe(1);
    expect(combination(5, 5)).toBe(1);
    expect(combination(5, 2)).toBe(10);
    expect(combination(5, 3)).toBe(10);
  });
});

describe('theoreticalPAtLeast (probabilidade hipergeométrica)', () => {
  it('15 dezenas → ~10,6% de acertar 11+', () => {
    const p = theoreticalPAtLeast(15, 11);
    expect(p).toBeGreaterThan(0.10);
    expect(p).toBeLessThan(0.11);
  });
  it('20 dezenas → ~94% de acertar 11+ (a única alavanca real)', () => {
    const p = theoreticalPAtLeast(20, 11);
    expect(p).toBeGreaterThan(0.93);
    expect(p).toBeLessThan(0.95);
  });
  it('tabela teórica tem 6 linhas (15–20) em ordem crescente de probabilidade', () => {
    const table = getTheoreticalTable();
    expect(table).toHaveLength(6);
    for (let i = 1; i < table.length; i++) {
      expect(table[i].probability).toBeGreaterThan(table[i - 1].probability);
    }
    expect(table[0].pickCount).toBe(15);
    expect(table[5].pickCount).toBe(20);
  });
});

describe('extractStructure (estrutura de um sorteio)', () => {
  it('extrai soma, paridade, blocos e intervalos corretamente', () => {
    const s = extractStructure(DRAWN);
    expect(s.sum).toBe(120);
    expect(s.oddCount).toBe(8);
    expect(s.evenCount).toBe(7);
    expect(s.maxBlock).toBe(15); // 1..15 é um bloco único
    expect(s.blocksGte2).toBe(1);
    expect(s.avgGap).toBe(1);
    expect(s.maxGap).toBe(1);
  });
  it('um sorteio espalhado tem blocos pequenos e gaps maiores', () => {
    // 15 números com gap médio > 1 e bloco máximo pequeno (3)
    const s = extractStructure([1, 5, 9, 13, 17, 21, 25, 2, 6, 10, 14, 18, 22, 3, 8]);
    expect(s.maxBlock).toBeLessThanOrEqual(3);
    expect(s.blocksGte2).toBeGreaterThan(0);
    expect(s.avgGap).toBeGreaterThan(1);
    expect(s.maxGap).toBeGreaterThan(1);
  });
});

describe('buildProfile (perfil com peso temporal)', () => {
  const draws = [];
  for (let i = 0; i < 400; i++) {
    // gera sorteios determinísticos com soma na faixa central
    draws.push([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  }

  it('monta perfil com janela dos recentes e peso exponencial', () => {
    const p = buildProfile(draws);
    expect(p.contests).toBe(300); // windowSize default
    expect(p.structure).toBeDefined();
    expect(p.structure.sum.mean).toBe(120);
    expect(p.structure.odd).toBe(8);
    expect(p.frequency).toHaveLength(26); // índices 0..25
  });
  it('com poucos dados não quebra', () => {
    const p = buildProfile([]);
    expect(p.contests).toBe(0);
    expect(p.structure).toBeNull();
  });
  it('getActiveStructure converte perfil em template acionável', () => {
    const p = buildProfile(draws);
    const active = getActiveStructure(p);
    expect(active.sumBand).toEqual([170, 220]);
    expect(active.oddTarget).toBe(8);
    expect(active.hot).toHaveLength(5);
    expect(active.cold).toHaveLength(5);
  });
});

describe('detectAnomalies (detetive temporal)', () => {
  it('sorteios uniformes não geram anomalias (ou poucas — aceitamos margem)', () => {
    // 800 concursos: cada número aparece com frequência uniforme (sem viés)
    const draws = [];
    for (let i = 0; i < 800; i++) {
      const nums = new Set();
      while (nums.size < 15) nums.add(Math.floor(Math.random() * 25) + 1);
      draws.push([...nums]);
    }
    const r = detectAnomalies(draws, 8);
    expect(r.eras).toBe(8);
    expect(Array.isArray(r.anomalies)).toBe(true);
    // com puro acaso, o esperado de "significativos" é ~1,25/25 — aceitamos ≤ 5
    expect(r.anomalies.length).toBeLessThanOrEqual(5);
  });
  it('com poucos concursos retorna sem anomalias (era < 30 sorteios)', () => {
    const r = detectAnomalies([DRAWN], 8);
    expect(r.eras).toBe(0);
    expect(r.reason).toBeDefined();
  });
});

describe('theoreticalSumBandFraction (faixa central do espaço)', () => {
  it('a maioria das C(25,15) tem soma entre 170 e 220 (~acima de 80%)', () => {
    const frac = theoreticalSumBandFraction();
    expect(frac).toBeGreaterThan(0.8);
    expect(frac).toBeLessThan(0.95);
  });
});
