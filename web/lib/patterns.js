/**
 * lib/patterns.js — MOTOR 1: PADRÕES ESTRUTURAIS ("qual estrutura está em vigor AGORA?").
 *
 * Estuda a ESTRUTURA das combinações (não números individuais), usando TODOS
 * os concursos históricos com PESO TEMPORAL nos mais recentes — o objetivo é
 * aprender o padrão que está vigorando no momento, atualizando a cada concurso
 * novo que entra no cache (o "acréscimo do último resultado").
 *
 * Estruturas analisadas por sorteio:
 *   - soma das dezenas (faixa central 170–220 concentra ~85% dos sorteios)
 *   - maior bloco consecutivo (4–5 em ~58% dos sorteios)
 *   - nº de blocos de tamanho ≥ 2
 *   - intervalo médio entre dezenas (~0,59)
 *   - paridade (pares/ímpares)
 *
 * Também compara o observado com o ESPAÇO TEÓRICO (C(25,15)) para nunca
 * vender ruído como padrão, e detecta ANOMALIAS temporais (z-scores por era)
 * — o "detetive" que sinaliza quando um padrão começou/parou de divergir.
 *
 * Funções PURAS e testáveis: recebem `draws` (array de arrays de 15 números).
 */

// ==================== COMBINATÓRIA / ESPAÇO TEÓRICO ====================

function combination(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let res = 1;
  for (let i = 1; i <= k; i++) res = (res * (n - k + i)) / i;
  return Math.round(res);
}

/**
 * Probabilidade TEÓRICA de um jogo com `pickCount` dezenas acertar ≥ `minHits`
 * das 15 sorteadas (distribuição hipergeométrica: N=25, K=drawn=15, n=pick).
 * Independe de QUAIS números — toda combinação do mesmo tamanho tem a mesma chance.
 */
function theoreticalPAtLeast(pickCount, minHits = 11) {
  let num = 0;
  for (let i = minHits; i <= 15; i++) {
    num += combination(pickCount, i) * combination(25 - pickCount, 15 - i);
  }
  return num / combination(25, 15);
}

/**
 * Tabela teórica de P(≥11) por quantidade de dezenas (15–20).
 * Confirma o fato central: a única alavanca real é jogar MAIS dezenas.
 */
function getTheoreticalTable() {
  const rows = [];
  for (let k = 15; k <= 20; k++) {
    rows.push({ pickCount: k, probability: theoreticalPAtLeast(k) });
  }
  return rows;
}

// ==================== EXTRAÇÃO DE ESTRUTURA ====================

/**
 * Estrutura de UM sorteio (array de 15 números).
 * Retorna as métricas estruturais que o motor aprende.
 */
function extractStructure(draw) {
  const sorted = [...draw].map(n => parseInt(n, 10)).sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const odd = sorted.filter(n => n % 2 === 1).length;

  // Blocos consecutivos: maior bloco e nº de blocos de tamanho ≥ 2
  let maxBlock = 1;
  let blocksGte2 = 0;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run++;
      if (run > maxBlock) maxBlock = run;
    } else {
      if (run >= 2) blocksGte2++;
      run = 1;
    }
  }
  if (run >= 2) blocksGte2++;

  // Intervalos entre dezenas ordenadas (gap médio e maior gap)
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1]);
  const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const maxGap = gaps.length ? Math.max(...gaps) : 0;

  return {
    sum,
    maxBlock,
    blocksGte2,
    oddCount: odd,
    evenCount: sorted.length - odd,
    avgGap,
    maxGap
  };
}

// ==================== PERFIL COM PESO TEMPORAL ====================

/**
 * Monta o perfil estrutural usando uma janela dos concursos mais recentes,
 * com decaimento exponencial: concursos mais novos pesam mais (o padrão que
 * está vigorando AGORA). `windowSize` (default 300) e `decay` (default 0.02)
 * são configuráveis — ambos são pesos que podem ser aprendidos por backtest.
 */
function buildProfile(draws, opts = {}) {
  const windowSize = opts.windowSize || 300;
  const decay = opts.decay !== undefined ? opts.decay : 0.02;

  const recent = draws.slice(-windowSize);
  if (recent.length === 0) {
    return { contests: 0, windowSize, decay, structure: null, frequency: null };
  }

  // Pesos exponenciais: w_i = exp(-decay * (N-1-i)) — o mais recente pesa 1
  const weights = recent.map((_, i) => Math.exp(-decay * (recent.length - 1 - i)));
  const totalW = weights.reduce((a, b) => a + b, 0);

  const sum = { weighted: 0 };
  const maxBlockDist = {};
  const blocksGte2Dist = {};
  const avgGap = { weighted: 0 };
  const oddDist = { weighted: 0 };
  const frequency = new Array(26).fill(0);

  recent.forEach((d, i) => {
    const s = extractStructure(d);
    const w = weights[i];
    sum.weighted += s.sum * w;
    avgGap.weighted += s.avgGap * w;
    oddDist.weighted += s.oddCount * w;
    maxBlockDist[s.maxBlock] = (maxBlockDist[s.maxBlock] || 0) + w;
    blocksGte2Dist[s.blocksGte2] = (blocksGte2Dist[s.blocksGte2] || 0) + w;
    d.forEach(n => { frequency[n] += w; });
  });

  // Normaliza distribuições (proporção do peso total)
  const normDist = dist => {
    const norm = {};
    for (const k of Object.keys(dist)) norm[k] = +(dist[k] / totalW).toFixed(4);
    return norm;
  };
  // Moda ponderada
  const modeOf = dist => Object.keys(dist).reduce((a, b) => (dist[b] > dist[a] ? b : a), '0');

  return {
    contests: recent.length,
    windowSize,
    decay,
    structure: {
      sum: { mean: +(sum.weighted / totalW).toFixed(1), band: [170, 220] },
      avgGap: +(avgGap.weighted / totalW).toFixed(3),
      odd: +(oddDist.weighted / totalW).toFixed(1),
      maxBlock: { mode: parseInt(modeOf(maxBlockDist), 10), distribution: normDist(maxBlockDist) },
      blocksGte2: { mode: parseInt(modeOf(blocksGte2Dist), 10), distribution: normDist(blocksGte2Dist) }
    },
    frequency: frequency.map(v => +(v / totalW).toFixed(4)),
    hot: Array.from({ length: 25 }, (_, i) => i + 1)
      .sort((a, b) => frequency[b] - frequency[a]).slice(0, 5),
    cold: Array.from({ length: 25 }, (_, i) => i + 1)
      .sort((a, b) => frequency[a] - frequency[b]).slice(0, 5)
  };
}

/**
 * A estrutura "em vigor agora" (o que o gerador deve usar).
 * Converte o perfil em um template estrutural acionável.
 */
function getActiveStructure(profile) {
  if (!profile || !profile.structure) return null;
  const s = profile.structure;
  return {
    sumBand: s.sum.band,
    targetSum: s.sum.mean,
    maxBlock: s.maxBlock.mode,
    avgGap: s.avgGap,
    oddTarget: Math.round(s.odd),
    hot: profile.hot,
    cold: profile.cold
  };
}

// ==================== ANOMALIAS TEMPORAIS (o "detetive") ====================

/**
 * Divide o histórico em `eras` (janelas) e calcula z-scores por número.
 * Sinaliza quando um número (ou métrica) começa/para de divergir do acaso —
 * o tipo de padrão que a história das "bolas mais leves" descreve.
 */
function detectAnomalies(draws, eras = 8) {
  if (draws.length === 0) return { eras: 0, anomalies: [] };
  const eraSize = Math.floor(draws.length / eras);
  if (eraSize < 30) return { eras: 0, anomalies: [], reason: 'poucos concursos' };

  const p = 15 / 25; // probabilidade de um número sair em um sorteio
  const se = Math.sqrt(p * (1 - p) / eraSize);
  const anomalies = [];

  for (let num = 1; num <= 25; num++) {
    const perEra = [];
    for (let e = 0; e < eras; e++) {
      const slice = draws.slice(e * eraSize, (e + 1) * eraSize);
      const count = slice.reduce((acc, d) => acc + (d.includes(num) ? 1 : 0), 0);
      const observed = count / slice.length;
      const z = (observed - p) / se;
      perEra.push({ era: e, z: +z.toFixed(2) });
    }
    // Número com 2+ eras significativas (|z|>1.96) ou 1 era muito forte (|z|>3)
    const strong = perEra.filter(x => Math.abs(x.z) > 1.96);
    if (strong.length >= 2 || strong.some(x => Math.abs(x.z) > 3)) {
      anomalies.push({ number: num, eras: strong });
    }
  }
  return { eras, eraSize, anomalies };
}

// ==================== COMPARAÇÃO COM O ESPAÇO TEÓRICO ====================

/**
 * Compara a distribuição observada de uma métrica com a TEÓRICA (uniforme).
 * Se observado ≈ teórico → o sorteio é consistente com o acaso (sem viés).
 * Se observado ≠ teórico → há um desvio que merece investigação.
 */
function compareToTheoretical(draws) {
  if (draws.length === 0) return null;
  const sums = draws.map(d => extractStructure(d).sum);
  const meanObs = sums.reduce((a, b) => a + b, 0) / sums.length;
  const inBandObs = sums.filter(s => s >= 170 && s <= 220).length / sums.length;

  // Espaço teórico: média esperada = 15 × 13 = 195 (uniforme 1..25)
  // e % de combinações C(25,15) com soma em [170,220] — calculada por
  // amostragem determinística da distribuição de soma.
  const expectedMean = 15 * 13; // 195
  const expectedInBand = theoreticalSumBandFraction();

  return {
    contests: draws.length,
    sum: {
      observedMean: +meanObs.toFixed(1),
      theoreticalMean: expectedMean,
      observedInBand: +(inBandObs * 100).toFixed(1),
      theoreticalInBand: +(expectedInBand * 100).toFixed(1),
      deviation: +((meanObs - expectedMean) / expectedMean * 100).toFixed(2) + '%'
    },
    verdict: Math.abs(meanObs - expectedMean) < 5 && Math.abs(inBandObs - expectedInBand) < 0.03
      ? 'consistente com o acaso (sem viés estrutural detectável)'
      : 'desvio do acaso detectado — investigar'
  };
}

/**
 * Fração teórica de combinações de 15 números de 25 cuja soma está em [170,220].
 * Cálculo exato por DP: dp[s][k] = nº de combinações de k números com soma s.
 */
function theoreticalSumBandFraction(lo = 170, hi = 220) {
  // dp[k][s]
  let dp = new Array(16).fill(null).map(() => new Array(271).fill(0));
  dp[0][0] = 1;
  for (let num = 1; num <= 25; num++) {
    const next = new Array(16).fill(null).map(() => new Array(271).fill(0));
    for (let k = 0; k <= 15; k++) {
      for (let s = 0; s <= 270; s++) {
        if (dp[k][s] === 0) continue;
        next[k][s] += dp[k][s]; // não usar o número
        if (k < 15 && s + num <= 270) next[k + 1][s + num] += dp[k][s]; // usar
      }
    }
    dp = next;
  }
  let inBand = 0;
  for (let s = lo; s <= hi; s++) inBand += dp[15][s];
  return inBand / combination(25, 15);
}

// ==================== EXPORT ====================

module.exports = {
  combination,
  theoreticalPAtLeast,
  getTheoreticalTable,
  extractStructure,
  buildProfile,
  getActiveStructure,
  detectAnomalies,
  compareToTheoretical,
  theoreticalSumBandFraction
};
