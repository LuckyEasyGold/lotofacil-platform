/**
 * routes/wallet.js — Carteira digital com RECEBIMENTO REAL via PIX.
 *
 * Modelo portado do whodo-next:
 *  - DEPÓSITO: o usuário solicita um depósito → o sistema gera um QR Code PIX
 *    estático (BR Code) e cria uma cobrança com status 'pending'. O saldo NÃO
 *    é creditado automaticamente. O admin confirma manualmente o pagamento
 *    (POST /api/wallet/deposit/:id/confirm) → só então o saldo cai na conta.
 *  - SAQUE: exige um destino real (chave PIX digitada ou dado bancário salvo).
 *    O saldo é debitado na hora e a transação fica 'pending' até o admin
 *    processar (confirm = pagou; cancel = estorna o saldo de volta).
 *  - DADOS BANCÁRIOS: CRUD de chaves PIX / contas para o usuário receber saques.
 */
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { asyncRouter, sendError } = require('../lib/http');
const { requireAuth, requireAdmin } = require('../lib/auth');
const {
  validate, depositSchema, withdrawSchema, bankDetailsSchema
} = require('../lib/validation');
const { addNotification } = require('../lib/notifications');
const { formatBRL } = require('../lib/format');
const { gerarPix } = require('../lib/pix');

const router = asyncRouter();

const PIX_EXPIRATION_MINUTES = 60;

/** GET /api/wallet — Saldo + transações */
router.get('/api/wallet', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const userTransactions = await db.getUserTransactions(user.id);
  res.json({
    balance: user.balance, bonusBalance: user.bonusBalance,
    totalWinnings: user.totalWinnings, transactions: userTransactions
  });
});

// ==================== DEPÓSITO (PIX + CONFIRMAÇÃO DO ADMIN) ====================

/**
 * POST /api/wallet/deposit — Solicita um depósito gerando cobrança PIX.
 * NÃO credita saldo: cria pix_charges (pending) + transação pending e devolve
 * o QR Code para o usuário pagar. O admin confirma em /api/wallet/deposit/:id/confirm.
 */
router.post('/api/wallet/deposit', requireAuth, validate(depositSchema), async (req, res) => {
  const amount = parseFloat(req.body.amount);
  const user = req.currentUser;

  try {
    const pix = await gerarPix(Math.round(amount * 100), `Depósito Lotofácil ${formatBRL(amount)}`);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PIX_EXPIRATION_MINUTES * 60 * 1000);

    const charge = await db.createPixCharge({
      id: uuidv4(), userId: user.id, amount,
      payload: pix.qr_code, qrCode: pix.qr_code, qrCodeBase64: pix.qr_code_base64,
      txid: pix.txid, status: 'pending', expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString()
    });

    // Transação pending para aparecer no extrato (saldo ainda não muda).
    // A descrição embute o charge.id para o confirm/cancel fazer match EXATO
    // (evita pegar transação errada quando há 2 depósitos iguais pendentes).
    await db.addTransaction({
      id: uuidv4(), userId: user.id, type: 'deposit', amount,
      description: `Depósito PIX ${formatBRL(amount)} — aguardando pagamento [${charge.id}]`,
      date: now, status: 'pending'
    });

    await addNotification(user.id, 'wallet', 'Depósito PIX gerado!',
      `Escaneie o QR Code e pague ${formatBRL(amount)}. O saldo é liberado após a confirmação.`,
      '/carteira');

    res.json({
      success: true,
      pixCharge: {
        id: charge.id, amount: charge.amount,
        qrCode: charge.qrCode, qrCodeBase64: charge.qrCodeBase64,
        txid: charge.txid, status: charge.status,
        expiresAt: charge.expiresAt
      }
    });
  } catch (e) {
    sendError(res, e, 'POST /api/wallet/deposit');
  }
});

/** GET /api/wallet/deposits — Cobranças PIX do usuário (para acompanhar status). */
router.get('/api/wallet/deposits', requireAuth, async (req, res) => {
  const charges = await db.getUserPixCharges(req.currentUser.id);
  res.json({ deposits: charges });
});

/**
 * POST /api/wallet/deposit/:id/confirm — ADMIN confirma o pagamento PIX.
 * Credita o saldo, marca a cobrança como paga e a transação como completed.
 */
router.post('/api/wallet/deposit/:id/confirm', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Confirmação ATÔMICA: UPDATE ... WHERE status='pending' — se outra
    // confirmação concorrente já tiver processado, retorna null (409).
    const charge = await db.confirmPixCharge(req.params.id, req.currentUser.id);
    if (!charge) {
      const exists = await db.getPixChargeById(req.params.id);
      if (!exists) return res.status(404).json({ error: 'Cobrança não encontrada' });
      return res.status(409).json({ error: 'Cobrança já processada' });
    }

    // Creditar saldo (a cobrança já foi marcada como paga acima)
    await db.adjustUserBalance(charge.userId, charge.amount);

    // Atualizar a transação pending correspondente → completed (query direcionada
    // pelo charge.id embutido na descrição — sem limite de 50 transações)
    const txn = await db.getPendingDepositTxnByCharge(charge.userId, charge.id);
    if (txn) await db.updateTransactionStatus(txn.id, 'completed');

    await addNotification(charge.userId, 'wallet', 'Depósito confirmado!',
      `${formatBRL(charge.amount)} foram adicionados à sua carteira.`, '/carteira');

    res.json({ success: true, balance: (await db.getUserById(charge.userId)).balance });
  } catch (e) {
    sendError(res, e, 'POST /api/wallet/deposit/:id/confirm');
  }
});

/** POST /api/wallet/deposit/:id/cancel — ADMIN cancela cobrança (pagamento não recebido). */
router.post('/api/wallet/deposit/:id/cancel', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Cancelamento ATÔMICO (idempotente): só processa se ainda estiver pending
    const charge = await db.cancelPixCharge(req.params.id);
    if (!charge) {
      const exists = await db.getPixChargeById(req.params.id);
      if (!exists) return res.status(404).json({ error: 'Cobrança não encontrada' });
      return res.status(409).json({ error: 'Cobrança já processada' });
    }

    const txn = await db.getPendingDepositTxnByCharge(charge.userId, charge.id);
    if (txn) await db.updateTransactionStatus(txn.id, 'failed');

    res.json({ success: true });
  } catch (e) {
    sendError(res, e, 'POST /api/wallet/deposit/:id/cancel');
  }
});

// ==================== SAQUE (EXIGE DESTINO REAL) ====================

/**
 * POST /api/wallet/withdraw — Solicita saque para chave PIX / dado bancário.
 * Debita o saldo NA HORA e cria transação 'pending' até o admin processar.
 */
router.post('/api/wallet/withdraw', requireAuth, validate(withdrawSchema), async (req, res) => {
  const amount = parseFloat(req.body.amount);
  const user = req.currentUser;

  // Resolver o destino: dado bancário salvo OU chave PIX digitada
  let chavePix = req.body.chavePix || null;
  let destino = chavePix || '';

  if (req.body.bankDetailsId) {
    const bankDetail = await db.getBankDetailById(req.body.bankDetailsId, user.id);
    if (!bankDetail) return res.status(404).json({ error: 'Dado bancário não encontrado' });
    chavePix = bankDetail.chavePix;
    destino = bankDetail.chavePix || (bankDetail.bancoNome ? `Conta ${bankDetail.bancoNome} ${bankDetail.conta || ''}` : '');
  }

  if (!destino) return res.status(400).json({ error: 'Informe a chave PIX de destino do saque' });

  if (amount > user.balance) return res.status(400).json({ error: 'Saldo insuficiente' });

  // Debita na hora (whodo-next: registrarSaque debita e deixa pendente)
  await db.adjustUserBalance(user.id, -amount);

  const txn = {
    id: uuidv4(), userId: user.id, type: 'withdrawal', amount: -amount,
    description: `Saque para ${destino} (${chavePix ? 'PIX' : 'conta'}) — ${formatBRL(amount)}`,
    date: new Date(), status: 'pending'
  };
  await db.addTransaction(txn);

  await addNotification(user.id, 'wallet', 'Saque solicitado!',
    `Sua solicitação de ${formatBRL(amount)} está em processamento.`, '/carteira');

  const updated = await db.getUserById(user.id);
  res.json({ success: true, transaction: txn, balance: updated.balance });
});

/**
 * POST /api/wallet/withdraw/:id/confirm — ADMIN confirma que o saque foi pago.
 * O saldo já foi debitado na solicitação; aqui apenas finaliza a transação.
 */
router.post('/api/wallet/withdraw/:id/confirm', requireAuth, requireAdmin, async (req, res) => {
  try {
    const txn = await db.getTransactionById(req.params.id);
    if (!txn || txn.type !== 'withdrawal') return res.status(404).json({ error: 'Saque não encontrado' });
    if (txn.status !== 'pending') return res.status(409).json({ error: 'Saque já processado' });

    await db.updateTransactionStatus(txn.id, 'completed');

    await addNotification(txn.userId, 'wallet', 'Saque pago!',
      `O saque de ${formatBRL(Math.abs(txn.amount))} foi processado com sucesso.`, '/carteira');

    res.json({ success: true });
  } catch (e) {
    sendError(res, e, 'POST /api/wallet/withdraw/:id/confirm');
  }
});

/**
 * POST /api/wallet/withdraw/:id/cancel — ADMIN cancela o saque → ESTORNA o saldo.
 */
router.post('/api/wallet/withdraw/:id/cancel', requireAuth, requireAdmin, async (req, res) => {
  try {
    const txn = await db.getTransactionById(req.params.id);
    if (!txn || txn.type !== 'withdrawal') return res.status(404).json({ error: 'Saque não encontrado' });
    if (txn.status !== 'pending') return res.status(409).json({ error: 'Saque já processado' });

    // Estornar o saldo que foi debitado
    await db.adjustUserBalance(txn.userId, Math.abs(txn.amount));
    await db.updateTransactionStatus(txn.id, 'failed');

    await addNotification(txn.userId, 'wallet', 'Saque cancelado',
      `O saque de ${formatBRL(Math.abs(txn.amount))} foi cancelado e o valor devolvido à sua carteira.`, '/carteira');

    res.json({ success: true });
  } catch (e) {
    sendError(res, e, 'POST /api/wallet/withdraw/:id/cancel');
  }
});

// ==================== DADOS BANCÁRIOS (destino de saques) ====================

/** GET /api/wallet/bank-details — Lista os dados bancários do usuário. */
router.get('/api/wallet/bank-details', requireAuth, async (req, res) => {
  const details = await db.getUserBankDetails(req.currentUser.id);
  res.json({ bankDetails: details });
});

/** POST /api/wallet/bank-details — Salva uma chave PIX / conta. */
router.post('/api/wallet/bank-details', requireAuth, validate(bankDetailsSchema), async (req, res) => {
  const detail = await db.createBankDetail({
    id: uuidv4(), userId: req.currentUser.id,
    chavePix: req.body.chavePix,
    bancoNome: req.body.bancoNome || null,
    bancoCodigo: req.body.bancoCodigo || null,
    agencia: req.body.agencia || null,
    conta: req.body.conta || null,
    tipoConta: req.body.tipoConta || null,
    titularNome: req.body.titularNome || null,
    cpfCnpj: req.body.cpfCnpj || null,
    createdAt: new Date().toISOString()
  });
  res.json({ success: true, bankDetail: detail });
});

/** DELETE /api/wallet/bank-details/:id — Remove um dado bancário do usuário. */
router.delete('/api/wallet/bank-details/:id', requireAuth, async (req, res) => {
  const detail = await db.getBankDetailById(req.params.id, req.currentUser.id);
  if (!detail) return res.status(404).json({ error: 'Dado bancário não encontrado' });
  await db.deleteBankDetail(req.params.id, req.currentUser.id);
  res.json({ success: true });
});

// ==================== ADMIN: FILA DE APROVAÇÃO ====================

/** GET /api/admin/finance/pending — Depósitos PIX e saques aguardando o admin. */
router.get('/api/admin/finance/pending', requireAuth, requireAdmin, async (req, res) => {
  const [deposits, withdrawals] = await Promise.all([
    db.getPendingPixCharges(),
    db.getPendingWithdrawals()
  ]);
  res.json({ deposits, withdrawals });
});

module.exports = router;
