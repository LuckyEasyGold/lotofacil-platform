/**
 * lib/format.js — Formatação pt-BR de valores monetários (separador de milhar).
 *
 * Antes o código espalhava `value.toFixed(2).replace('.', ',')` em ~20 lugares,
 * que trocava o ponto decimal por vírgula mas NÃO adicionava o separador de
 * milhar (ex.: 46512.00 virava "46512,00" em vez de "46.512,00").
 *
 * Uso no servidor (mensagens, notificações):
 *   const { brl, formatBRL } = require('../lib/format');
 *   brl(46512)        // "46.512,00"
 *   formatBRL(46512)  // "R$ 46.512,00"
 *
 * No cliente (views), usar as funções globais do layout.ejs:
 *   formatNumberBR(46512)  // "46.512,00"
 *   formatCurrency(46512)  // "R$ 46.512,00"
 */

/** Formata número para pt-BR com separador de milhar e 2 casas decimais. */
function brl(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return '0,00';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formata com prefixo "R$". */
function formatBRL(value) {
  return 'R$ ' + brl(value);
}

module.exports = { brl, formatBRL };
