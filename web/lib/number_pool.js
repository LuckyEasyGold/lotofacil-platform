/**
 * lib/number_pool.js — MOTOR 2: POOL DE NÚMEROS ("com o que preencher a estrutura?").
 *
 * O Motor 1 (lib/patterns.js) descobre a ESTRUTURA em vigor (soma, blocos,
 * intervalos, paridade). Este Motor 2 descobre QUAIS NÚMEROS preencher essa
 * estrutura: um pool de ~20 dos 25 números — mesclando os QUENTES com os
 * FRIOS em uma PROPORÇÃO aprendida por backtest (não usa todos os 25).
 *
 * Peso aprendido: hotShare = fração do pool que vem dos números quentes.
 * O pool reduzido (~20 de 25) é um padrão a ser buscado — o tamanho também
 * pode ser aprendido (18/20/22), mas o default é 20.
 *
 * Funções PURAS e testáveis: recebem `draws` e retornam estruturas de dados.
 */

const { extractStructure } = require('./patterns');

const TOTAL = 25;
const DRAWN = 15;

// ==================== SCORES POR RECÊNCIA ====================

/**
 * Score de cada número (1–25) com peso temporal (recentes pesam mais).
 * @param {number[][]} draws — concursos (arrays de 15 números)
 * @param {object} opts — { windowSize, decay } (mesma convenção do patterns.js)
 * @returns {number[]} scores[1..25] normalizados
 */
function computeScores(draws, opts = {}) {
  const windowSize = opts.windowSize || 300;
  const decay = opts.decay !== undefined ? opts.decay : 0.02;
  const recent = draws.slice(-windowSize);
  if (recent.length === 0) return new Array(TOTAL + 1).fill(0);

  const weights = recent.map((_, i) => Math.exp(-decay * (recent.length - 1 - i)));
  const totalW = weights.reduce((a, b) => a + b, 0) || 1;
  const scores = new Array(TOTAL + 1).fill(0);
  recent.forEach((d, i) => {
    const w = weights[i];
    d.forEach(n => { scores[n] += w; });
  });
  return scores.map(v => +(v / totalW).toFixed(4));
}

/**
 * Rankeia os números por score (do mais quente ao mais frio).
 * @returns {number[]} números 1..25 em ordem decrescente de score
 */
function rankNumbers(scores) {
  return Array.from({ length: TOTAL }, (_, i) => i + 1)
    .sort((a, b) => scores[b] - scores[a]);
}

// ==================== APRENDIZADO DO SPLIT QUENTES/FRIOS ====================

/**
 * Aprende a proporção quentes/frios por BACKTEST out-of-sample:
 * divide o histórico em treino (primeiros 70%) e teste (últimos 30%),
 * testa vários hotShare e devolve o que maximizou a taxa de ≥11 no teste.
 *
 * @param {number[][]} draws
 * @returns {number} hotShare ótimo (0..1)
 */
function learnHotColdSplit(draws) {
  if (draws.length < 200) return 0.6; // padrão com poucos dados
  const splitIdx = Math.floor(draws.length * 0.7);
  const train = draws.slice(0, splitIdx);
  const test = draws.slice(splitIdx);
  const scores = computeScores(train, { windowSize: Math.min(500, train.length), decay: 0 });
  const ranked = rankNumbers(scores);

  let best = { share: 0.6, rate: -1 };
  for (const share of [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
    const hotCount = Math.round(share * 20);
    const pool = [
      ...ranked.slice(0, hotCount),
      ...ranked.slice(TOTAL - (20 - hotCount))
    ];
    const poolSet = new Set(pool);
    let hits = 0;
    for (const d of test) {
      let m = 0;
      for (const n of d) if (poolSet.has(n)) m++;
      if (m >= 11) hits++;
    }
    const rate = hits / test.length;
    if (rate > best.rate) best = { share, rate };
  }
  return best.share;
}

/**
 * Aprende o TAMANHO do pool (18/20/22) por backtest: qual cobertura de ≥11
 * o pool proporciona no teste (números do pool que acertam ≥11 = chance de
 * pelo menos um jogo 15-dezenas dentro dele premiar).
 */
function learnPoolSize(draws) {
  if (draws.length < 200) return 20;
  const splitIdx = Math.floor(draws.length * 0.7);
  const train = draws.slice(0, splitIdx);
  const test = draws.slice(splitIdx);
  const scores = computeScores(train, { windowSize: Math.min(500, train.length), decay: 0 });
  const ranked = rankNumbers(scores);

  let best = { size: 20, rate: -1 };
  for (const size of [18, 20, 22]) {
    const poolSet = new Set(ranked.slice(0, size));
    let hits = 0;
    for (const d of test) {
      let m = 0;
      for (const n of d) if (poolSet.has(n)) m++;
      if (m >= 11) hits++;
    }
    const rate = hits / test.length;
    if (rate > best.rate) best = { size, rate };
  }
  return best.size;
}

// ==================== POOL ====================

/**
 * Monta o pool de números: hotShare% dos mais quentes + (1-hotShare)% dos
 * mais frios, totalizando `size` números (~20 de 25).
 * @returns {{ pool: number[], hotShare: number, size: number, scores: number[] }}
 */
function buildPool(draws, opts = {}) {
  const size = opts.size || learnPoolSize(draws);
  const hotShare = opts.hotShare !== undefined ? opts.hotShare : learnHotColdSplit(draws);
  const scores = computeScores(draws, opts);
  const ranked = rankNumbers(scores);
  const hotCount = Math.round(size * hotShare);
  const coldCount = size - hotCount;
  const pool = [
    ...ranked.slice(0, hotCount),
    ...ranked.slice(TOTAL - coldCount)
  ];
  return { pool, hotShare, size, scores };
}

// ==================== GERAÇÃO ESTRUTURADA ====================

/**
 * Gera N jogos de `pickCount` dezenas que seguem a estrutura ativa (soma na
 * faixa, paridade, blocos) usando números do pool.
 *
 * Estratégia: pega a estrutura ativa do Motor 1 e preenche com números do
 * pool (Motor 2), respeitando:
 *   - soma dentro da faixa central (band);
 *   - paridade próxima do alvo (oddTarget);
 *   - máximo de números consecutivos ≤ limite (evita sequências óbvias que
 *     todo mundo joga — anti-rateio).
 *
 * @param {object} activeStructure — de patterns.getActiveStructure(profile)
 * @param {object} poolResult — de buildPool()
 * @param {object} opts — { quantity, pickCount }
 * @returns {number[][]} jogos (arrays de `pickCount` números ordenados)
 */
function generateStructuredGames(activeStructure, poolResult, opts = {}) {
  const quantity = opts.quantity || 10;
  const pickCount = opts.pickCount || DRAWN;
  const pool = poolResult.pool || [];
  if (pool.length < pickCount) return [];

  // activeStructure pode ser null (banco vazio) — defaults da faixa central
  const structure = activeStructure || {};
  const band = structure.sumBand || [170, 220];
  const oddTarget = structure.oddTarget !== undefined ? structure.oddTarget : 7;
  const maxBlock = structure.maxBlock || 5;
  const antiRateio = opts.antiRateio !== undefined ? opts.antiRateio : true;

  const games = [];
  let guard = 0;
  while (games.length < quantity && guard < quantity * 500) {
    guard++;
    const game = pickFromPool(pool, pickCount);
    const s = extractStructure(game);
    // Filtros estruturais (tolerância para não travar)
    const sumOk = s.sum >= band[0] - 10 && s.sum <= band[1] + 10;
    const parityOk = Math.abs(s.oddCount - oddTarget) <= 3;
    // anti-rateio: com ele ligado, evita sequências longas (bloco máx = aprendido);
    // desligado, tolera 1 a mais (jogos mais "espalhados"/aleatórios)
    const blockOk = antiRateio ? s.maxBlock <= maxBlock : s.maxBlock <= maxBlock + 1;
    if (sumOk && parityOk && blockOk) {
      games.push(game);
    }
  }
  // Se a estrutura for muito restritiva, preenche com jogos do pool (sem filtro).
  // Guard obrigatório: se pool.length === pickCount só existe 1 combinação única
  // — sem o guard, o loop ficaria infinito (cada pick repete o mesmo jogo).
  let fill = 0;
  while (games.length < quantity && fill < quantity * 500) {
    fill++;
    const game = pickFromPool(pool, pickCount);
    if (!games.some(g => g.join(',') === game.join(','))) games.push(game);
  }
  return games;
}

/**
 * Seleciona `pickCount` números do pool via roleta ponderada pelo score
 * (os mais quentes do pool têm mais chance — o motor genético antigo é
 * substituído por esta ponderação mais simples e transparente).
 */
function pickFromPool(pool, pickCount) {
  // Nota: como o pool já mistura quentes+frios na proporção aprendida, a
  // seleção dentro do pool é uniforme (cada número do pool tem peso igual).
  const selected = new Set();
  while (selected.size < pickCount) {
    const idx = Math.floor(Math.random() * pool.length);
    selected.add(pool[idx]);
  }
  return [...selected].sort((a, b) => a - b);
}

// ==================== EXPORT ====================

module.exports = {
  TOTAL,
  DRAWN,
  computeScores,
  rankNumbers,
  learnHotColdSplit,
  learnPoolSize,
  buildPool,
  generateStructuredGames,
  pickFromPool
};
