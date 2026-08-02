/**
 * lib/lottery.js — Configurações das loterias (extraído do server.js).
 *
 * Centraliza os parâmetros por tipo de jogo: validação (min/max de dezenas),
 * preços oficiais da Caixa (base × C(n, pickCount)) e prêmios.
 *
 * PREÇOS OFICIAIS (Caixa Econômica Federal):
 *   Lotofácil  : base R$ 3,00  (15 dezenas) → 16=R$48 · 17=R$408 · 18=R$2.448
 *                · 19=R$11.628 · 20=R$46.512   (preço = 3,00 × C(n,15))
 *   Mega-Sena  : base R$ 5,00  (6 dezenas)  → 7=R$35 · 8=R$140 … 15=R$25.025
 *                (preço = 5,00 × C(n,6))
 *   Quina      : base R$ 2,50  (5 dezenas)  → 6=R$15 · 7=R$52,50 … 15=R$7.507,50
 *                (preço = 2,50 × C(n,5))
 *   Lotomania  : R$ 3,00 fixo (20 dezenas de 100; modalidade sem "surpresinha+")
 *
 * O ADMIN pode sobrescrever o preço por quantidade de dezenas (persistido na
 * tabela `lottery_config` do banco). As funções getGamePrice/getPriceTable
 * sempre consideram os overrides quando existem.
 */

const LOTTERY_CONFIGS = {
  LOTOFACIL: {
    name: 'Lotofácil', totalNumbers: 25,
    pickCount: 15, minPick: 15, maxPick: 20,
    basePrice: 3.00, price: 3.00
  },
  MEGASENA: {
    name: 'Mega-Sena', totalNumbers: 60,
    pickCount: 6, minPick: 6, maxPick: 15,
    basePrice: 5.00, price: 5.00
  },
  QUINA: {
    name: 'Quina', totalNumbers: 80,
    pickCount: 5, minPick: 5, maxPick: 15,
    basePrice: 2.50, price: 2.50
  },
  LOTOMANIA: {
    name: 'Lotomania', totalNumbers: 100,
    pickCount: 20, minPick: 20, maxPick: 20,
    basePrice: 3.00, price: 3.00
  }
};

const PRIZE_TABLES = {
  LOTOFACIL: { 11: 6, 12: 12, 13: 30, 14: 1124.87, 15: 924479.40 },
  MEGASENA: { 4: 12.50, 5: 1578.90, 6: 12500000.00 },
  QUINA: { 3: 5.80, 4: 125.60, 5: 1520000.00 },
  LOTOMANIA: { 16: 6.00, 17: 12.00, 18: 54.00, 19: 845.60, 20: 1250000.00 }
};

// Overrides de preço vindos do banco (admin): { gameType: { pickCount: price } }
let priceOverrides = {};

// ==================== COMBINATÓRIA (C(n,k)) ====================

function combination(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let res = 1;
  for (let i = 1; i <= k; i++) {
    res = (res * (n - k + i)) / i;
  }
  return Math.round(res);
}

function round2(v) { return Math.round(v * 100) / 100; }

// ==================== PREÇOS ====================

/**
 * Preço de uma aposta com `pickCount` dezenas.
 * Regra da Caixa: basePrice × C(pickCount, minPick). Admin pode sobrescrever
 * por quantidade (priceOverrides), ex.: Lotofácil 16 dezenas = R$ 48,00.
 */
function getGamePrice(gameType, pickCount) {
  const cfg = LOTTERY_CONFIGS[gameType];
  if (!cfg) return 0;
  const ov = priceOverrides[gameType];
  if (ov && ov[pickCount] != null) return Number(ov[pickCount]);
  return round2(cfg.basePrice * combination(pickCount, cfg.pickCount));
}

/** Tabela completa de preços de um tipo (minPick..maxPick). */
function getPriceTable(gameType) {
  const cfg = LOTTERY_CONFIGS[gameType];
  if (!cfg) return [];
  const table = [];
  for (let n = cfg.minPick; n <= cfg.maxPick; n++) {
    table.push({ pickCount: n, price: getGamePrice(gameType, n) });
  }
  return table;
}

/** Config efetiva de todas as loterias (para a API pública e o editor admin). */
function getLotteries() {
  return Object.keys(LOTTERY_CONFIGS).map(key => ({
    key,
    name: LOTTERY_CONFIGS[key].name,
    totalNumbers: LOTTERY_CONFIGS[key].totalNumbers,
    pickCount: LOTTERY_CONFIGS[key].pickCount,
    minPick: LOTTERY_CONFIGS[key].minPick,
    maxPick: LOTTERY_CONFIGS[key].maxPick,
    basePrice: LOTTERY_CONFIGS[key].basePrice,
    priceTable: getPriceTable(key)
  }));
}

/**
 * Aplica os overrides carregados do banco (formato do getLotteryConfigs() do
 * db.js): [{ gameType, prices: { "16": 48, ... } }]. Substitui o estado.
 */
function applyPriceOverrides(configs) {
  const next = {};
  for (const c of configs || []) {
    if (c && c.gameType && c.prices && typeof c.prices === 'object') {
      next[c.gameType] = c.prices;
    }
  }
  priceOverrides = next;
}

function getPriceOverrides() { return priceOverrides; }

module.exports = {
  LOTTERY_CONFIGS,
  PRIZE_TABLES,
  combination,
  getGamePrice,
  getPriceTable,
  getLotteries,
  applyPriceOverrides,
  getPriceOverrides
};
