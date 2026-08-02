/**
 * routes/lottery.js — Configuração pública das loterias (preços/tabelas).
 *
 * Expõe a tabela de preços EFETIVA (fórmula oficial da Caixa + overrides do
 * admin) para o frontend renderizar o valor da aposta conforme a quantidade
 * de dezenas selecionada — sem duplicar a regra de preço no cliente.
 */
const { asyncRouter } = require('../lib/http');
const { requireAuth } = require('../lib/auth');
const { getLotteries } = require('../lib/lottery');

const router = asyncRouter();

/** GET /api/lottery-config — Tabelas de preços por quantidade de dezenas */
router.get('/api/lottery-config', requireAuth, (req, res) => {
  res.json({ lotteries: getLotteries() });
});

module.exports = router;
