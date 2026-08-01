/**
 * lib/lottery.js — Configurações das loterias (extraído do server.js).
 * Centraliza os parâmetros por tipo de jogo para validação, preços e prêmios.
 */

const LOTTERY_CONFIGS = {
  LOTOFACIL: { name: 'Lotofácil', totalNumbers: 25, pickCount: 15, price: 3.00 },
  MEGASENA: { name: 'Mega-Sena', totalNumbers: 60, pickCount: 6, price: 5.00 },
  QUINA: { name: 'Quina', totalNumbers: 80, pickCount: 5, price: 2.50 },
  LOTOMANIA: { name: 'Lotomania', totalNumbers: 100, pickCount: 20, price: 3.00 }
};

const PRIZE_TABLES = {
  LOTOFACIL: { 11: 6, 12: 12, 13: 30, 14: 1124.87, 15: 924479.40 },
  MEGASENA: { 4: 12.50, 5: 1578.90, 6: 12500000.00 },
  QUINA: { 3: 5.80, 4: 125.60, 5: 1520000.00 },
  LOTOMANIA: { 16: 6.00, 17: 12.00, 18: 54.00, 19: 845.60, 20: 1250000.00 }
};

module.exports = { LOTTERY_CONFIGS, PRIZE_TABLES };
