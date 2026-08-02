/**
 * db.js — Camada de persistência PostgreSQL (Neon) para a Lotofácil Platform.
 *
 * Substitui os arquivos JSON e arrays em memória do server.js por tabelas
 * em um Postgres gerenciado (Neon, Supabase, etc.), permitindo o deploy
 * serverless no Vercel (filesystem read-only + instâncias efêmeras).
 */

require('dotenv').config();
// Também carrega .env.local (dev local / `vercel env pull`). Em produção o
// arquivo não existe; `quiet` evita warning. override dá prioridade ao .env.local.
require('dotenv').config({ path: '.env.local', override: true, quiet: true });

// Suíte de testes: TEST_DATABASE_URL aponta para um banco ISOLADO (não o de
// produção). Tem prioridade máxima sobre qualquer config. Em produção e em
// dev normal a variável não existe e nada muda.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não definida. Configure a connection string do Neon.');
}

const isNeon = DATABASE_URL && DATABASE_URL.includes('neon.tech');

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Neon recomenda SSL. Em dev local com Postgres sem SSL, use PGSSL=false
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
  max: parseInt(process.env.PG_MAX || '10', 10),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

// ==================== SCHEMA ====================

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  avatar TEXT,
  balance DOUBLE PRECISION DEFAULT 0,
  bonus_balance DOUBLE PRECISION DEFAULT 50,
  total_winnings DOUBLE PRECISION DEFAULT 0,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  numbers JSONB NOT NULL,
  game_type TEXT DEFAULT 'LOTOFACIL',
  name TEXT,
  source TEXT DEFAULT 'manual',
  seed_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  usage_history JSONB DEFAULT '[]',
  pool_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id);

CREATE TABLE IF NOT EXISTS pools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  game_type TEXT,
  contest_number INT,
  total_shares INT,
  available_shares INT,
  share_price DOUBLE PRECISION,
  base_value DOUBLE PRECISION DEFAULT 0,  -- Custo real dos jogos (pré-financiado pelo criador)
  admin_fee DOUBLE PRECISION DEFAULT 0,    -- Taxa administrativa do criador (transparente)
  min_shares INT DEFAULT 1,
  max_shares INT,
  numbers JSONB,
  games JSONB DEFAULT '[]',  -- Bolão com N jogos (IA estrutural): [[n1,...],[n2,...]]
  creator_name TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  participants JSONB DEFAULT '[]',
  market_offers JSONB DEFAULT '[]',
  results JSONB DEFAULT '[]'   -- Resultado do bolão após o sorteio: [{ contestNumber, games:[{hits,prize}], totalPrize, rateio:[{name,shares,amount}] }]
);
-- Migração segura: garante as colunas em bancos criados antes delas existirem.
ALTER TABLE pools ADD COLUMN IF NOT EXISTS games JSONB DEFAULT '[]';
ALTER TABLE pools ADD COLUMN IF NOT EXISTS results JSONB DEFAULT '[]';
ALTER TABLE pools ADD COLUMN IF NOT EXISTS base_value DOUBLE PRECISION DEFAULT 0;
ALTER TABLE pools ADD COLUMN IF NOT EXISTS admin_fee DOUBLE PRECISION DEFAULT 0;

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT,
  amount DOUBLE PRECISION,
  description TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'completed'
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);

CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  game_type TEXT,
  numbers JSONB,
  amount DOUBLE PRECISION,
  date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  game_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_id);
-- Migração segura: CREATE TABLE IF NOT EXISTS não altera tabelas existentes.
-- Garante a coluna game_id em bancos criados antes desta coluna existir.
ALTER TABLE bets ADD COLUMN IF NOT EXISTS game_id TEXT;

-- Preços por quantidade de dezenas configuráveis pelo admin (Caixa).
-- prices é um JSONB no formato { "16": 48.00, "17": 408.00, ... } — só as
-- quantidades sobrescritas; as demais usam a fórmula oficial base × C(n,k).
CREATE TABLE IF NOT EXISTS lottery_config (
  game_type TEXT PRIMARY KEY,
  prices JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT,
  title TEXT,
  message TEXT,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT,
  game_type TEXT,
  numbers JSONB,
  name TEXT,
  game_id TEXT,
  interval TEXT DEFAULT 'weekly',
  active BOOLEAN DEFAULT TRUE,
  next_contest INT,
  last_executed TIMESTAMPTZ,
  total_executions INT DEFAULT 0,
  total_spent DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS results (
  numero INT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seeds (
  game_type TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de sessões usada pelo connect-pg-simple (express-session).
-- Criada explicitamente aqui porque o auto-create do store é fire-and-forget
-- e não é confiável no ambiente serverless (causava 500 nas rotas autenticadas).
CREATE TABLE IF NOT EXISTS "session" (
  sid varchar NOT NULL,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL,
  PRIMARY KEY ("sid")
);

-- Cobranças PIX de depósito (modelo whodo-next): o usuário solicita um
-- depósito, o sistema gera um QR Code PIX estático e o admin confirma o
-- pagamento manualmente — só então o saldo é creditado.
CREATE TABLE IF NOT EXISTS pix_charges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  payload TEXT,
  qr_code TEXT,
  qr_code_base64 TEXT,
  txid TEXT,
  status TEXT DEFAULT 'pending',  -- pending | paid | canceled
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  confirmed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pix_charges_user ON pix_charges(user_id);

-- Dados bancários / chaves PIX do usuário para receber SAQUES.
CREATE TABLE IF NOT EXISTS bank_details (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chave_pix TEXT,
  banco_nome TEXT,
  banco_codigo TEXT,
  agencia TEXT,
  conta TEXT,
  tipo_conta TEXT,
  titular_nome TEXT,
  cpf_cnpj TEXT,
  verificado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bank_details_user ON bank_details(user_id);
`;

/** Cria as tabelas (idempotente). Chamado na inicialização. */
async function ensureSchema() {
  await pool.query(SCHEMA);
}

// ==================== HELPERS ====================

/**
 * JSON.stringify seguro para colunas JSONB.
 *
 * Dados vindos de APIs externas (ex.: Caixa) podem conter caracteres que o
 * Postgres rejeita em colunas JSONB com "unsupported Unicode escape sequence":
 *  - NUL (U+0000): texto do Postgres não pode conter NUL ("\\u0000 cannot be
 *    converted to text");
 *  - Lone surrogates UTF-16 (pares \\uD800-\\uDFFF quebrados).
 *
 * Substitui esses caracteres por U+FFFD (replacement character) mantendo o
 * JSON válido. A limpeza é feita no replacer (ANTES do stringify) para que o
 * JSON.stringify nunca emita escapes \\u0000/\\udXXX no output.
 */
function safeStringify(value) {
  return JSON.stringify(value, (key, val) => {
    if (typeof val === 'string') {
      return val
        .replace(/\u0000/g, '\uFFFD')
        .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '\uFFFD')
        .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD');
    }
    return val;
  });
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    avatar: row.avatar,
    balance: Number(row.balance) || 0,
    bonusBalance: Number(row.bonus_balance) || 0,
    totalWinnings: Number(row.total_winnings) || 0,
    role: row.role,
    createdAt: row.created_at ? row.created_at.toISOString() : null
  };
}

function mapGame(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    numbers: row.numbers,
    gameType: row.game_type,
    name: row.name,
    source: row.source,
    seedVersion: row.seed_version,
    createdAt: row.created_at ? row.created_at.toISOString() : null,
    status: row.status,
    usageHistory: row.usage_history || [],
    poolId: row.pool_id
  };
}

function mapPool(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    gameType: row.game_type,
    contestNumber: row.contest_number,
    totalShares: row.total_shares,
    availableShares: row.available_shares,
    sharePrice: Number(row.share_price),
    baseValue: Number(row.base_value) || 0,
    adminFee: Number(row.admin_fee) || 0,
    minShares: row.min_shares,
    maxShares: row.max_shares,
    numbers: row.numbers,
    games: row.games || [],
    creatorName: row.creator_name,
    status: row.status,
    createdAt: row.created_at,
    participants: row.participants || [],
    marketOffers: row.market_offers || [],
    results: row.results || []
  };
}

function mapTransaction(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: Number(row.amount),
    description: row.description,
    date: row.date,
    status: row.status
  };
}

function mapBet(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    gameType: row.game_type,
    numbers: row.numbers,
    amount: Number(row.amount),
    date: row.date,
    status: row.status,
    gameId: row.game_id || null
  };
}

function mapNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.link,
    read: row.read,
    createdAt: row.created_at ? row.created_at.toISOString() : null
  };
}

function mapSubscription(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    gameType: row.game_type,
    numbers: row.numbers,
    name: row.name,
    gameId: row.game_id,
    interval: row.interval,
    active: row.active,
    nextContest: row.next_contest,
    lastExecuted: row.last_executed ? row.last_executed.toISOString() : null,
    totalExecutions: row.total_executions,
    totalSpent: Number(row.total_spent) || 0,
    createdAt: row.created_at ? row.created_at.toISOString() : null
  };
}

// ==================== USERS ====================

async function getUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return mapUser(rows[0]);
}

async function getUserByEmail(email) {
  if (!email) return null;
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return mapUser(rows[0]);
}

async function getUserByName(name) {
  if (!name) return null;
  const { rows } = await pool.query('SELECT * FROM users WHERE name = $1 LIMIT 1', [name]);
  return mapUser(rows[0]);
}

async function createUser(user) {
  await pool.query(
    `INSERT INTO users (id, name, email, password, avatar, balance, bonus_balance, total_winnings, role, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [user.id, user.name, user.email, user.password, user.avatar,
     user.balance, user.bonusBalance, user.totalWinnings, user.role, user.createdAt]
  );
  return getUserById(user.id);
}

/** Atualização parcial: passa apenas os campos que mudaram */
async function updateUser(id, fields) {
  const allowed = ['name', 'email', 'avatar', 'role'];
  const sets = [];
  const params = [id];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${params.length + 1}`);
      params.push(fields[key]);
    }
  }
  // Campos numéricos: balance, bonus_balance, total_winnings
  for (const [key, col] of [['balance', 'balance'], ['bonusBalance', 'bonus_balance'], ['totalWinnings', 'total_winnings']]) {
    if (fields[key] !== undefined) {
      sets.push(`${col} = $${params.length + 1}`);
      params.push(fields[key]);
    }
  }
  if (sets.length === 0) return getUserById(id);
  await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, params);
  return getUserById(id);
}

/** Ajusta saldo (delta pode ser negativo). Retorna o novo saldo. */
async function adjustUserBalance(id, delta) {
  const { rows } = await pool.query(
    'UPDATE users SET balance = balance + $2 WHERE id = $1 RETURNING balance', [id, delta]
  );
  return rows[0] ? Number(rows[0].balance) : null;
}

/** Acumula ganhos totais. */
async function adjustUserWinnings(id, delta) {
  await pool.query(
    'UPDATE users SET total_winnings = total_winnings + $2 WHERE id = $1', [id, delta]
  );
}

// ==================== GAMES ====================

async function getUserGames(userId, filters = {}) {
  let sql = 'SELECT * FROM games WHERE user_id = $1';
  const params = [userId];
  if (filters.status) { params.push(filters.status); sql += ` AND status = $${params.length}`; }
  if (filters.source) { params.push(filters.source); sql += ` AND source = $${params.length}`; }
  if (filters.gameType) { params.push(filters.gameType); sql += ` AND game_type = $${params.length}`; }
  sql += ' ORDER BY created_at DESC';
  const { rows } = await pool.query(sql, params);
  return rows.map(mapGame);
}

async function getGameById(id, userId) {
  const { rows } = await pool.query('SELECT * FROM games WHERE id = $1 AND user_id = $2', [id, userId]);
  return mapGame(rows[0]);
}

async function createGame(game) {
  await pool.query(
    `INSERT INTO games (id, user_id, numbers, game_type, name, source, seed_version, created_at, status, usage_history, pool_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [game.id, game.userId, safeStringify(game.numbers), game.gameType, game.name,
     game.source, game.seedVersion, game.createdAt, game.status,
     safeStringify(game.usageHistory || []), game.poolId]
  );
  return getGameById(game.id, game.userId);
}

async function updateGame(id, fields) {
  const allowed = ['name', 'status', 'pool_id'];
  const sets = [];
  const params = [id];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${params.length + 1}`);
      params.push(fields[key]);
    }
  }
  if (fields.usageHistory !== undefined) {
    sets.push(`usage_history = $${params.length + 1}`);
    params.push(safeStringify(fields.usageHistory));
  }
  if (sets.length === 0) return null;
  const { rows } = await pool.query(
    `UPDATE games SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params
  );
  return mapGame(rows[0]);
}

async function deleteGame(id) {
  await pool.query('DELETE FROM games WHERE id = $1', [id]);
}

/** TODOS os jogos de todos os usuários — usado pela verificação diária (cron). */
async function getAllGames() {
  const { rows } = await pool.query('SELECT * FROM games ORDER BY created_at ASC');
  return rows.map(mapGame);
}

// ==================== POOLS ====================

async function getPools() {
  const { rows } = await pool.query('SELECT * FROM pools ORDER BY created_at ASC');
  return rows.map(mapPool);
}

async function getPoolById(id) {
  const { rows } = await pool.query('SELECT * FROM pools WHERE id = $1', [id]);
  return mapPool(rows[0]);
}

async function createPool(poolData) {
  await pool.query(
    `INSERT INTO pools (id, name, game_type, contest_number, total_shares, available_shares, share_price, base_value, admin_fee, min_shares, max_shares, numbers, games, creator_name, status, created_at, participants, market_offers)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [poolData.id, poolData.name, poolData.gameType, poolData.contestNumber, poolData.totalShares,
     poolData.availableShares, poolData.sharePrice, poolData.baseValue || 0, poolData.adminFee || 0,
     poolData.minShares, poolData.maxShares,
     safeStringify(poolData.numbers || []), safeStringify(poolData.games || []), poolData.creatorName, poolData.status,
     poolData.createdAt, safeStringify(poolData.participants || []), safeStringify(poolData.marketOffers || [])]
  );
  return getPoolById(poolData.id);
}

async function updatePool(id, fields) {
  const allowed = ['name', 'status'];
  const sets = [];
  const params = [id];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${params.length + 1}`);
      params.push(fields[key]);
    }
  }
  if (fields.availableShares !== undefined) {
    sets.push(`available_shares = $${params.length + 1}`);
    params.push(fields.availableShares);
  }
  if (fields.participants !== undefined) {
    sets.push(`participants = $${params.length + 1}`);
    params.push(safeStringify(fields.participants));
  }
  if (fields.marketOffers !== undefined) {
    sets.push(`market_offers = $${params.length + 1}`);
    params.push(safeStringify(fields.marketOffers));
  }
  if (fields.results !== undefined) {
    sets.push(`results = $${params.length + 1}`);
    params.push(safeStringify(fields.results));
  }
  if (sets.length === 0) return getPoolById(id);
  const { rows } = await pool.query(
    `UPDATE pools SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params
  );
  return mapPool(rows[0]);
}

// ==================== TRANSACTIONS ====================

async function getUserTransactions(userId, limit = null) {
  let sql = 'SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC';
  const params = [userId];
  if (limit) {
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
  }
  const { rows } = await pool.query(sql, params);
  return rows.map(mapTransaction);
}

async function addTransaction(txn) {
  await pool.query(
    `INSERT INTO transactions (id, user_id, type, amount, description, date, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [txn.id, txn.userId, txn.type, txn.amount, txn.description, txn.date, txn.status]
  );
  return getUserTransactions(txn.userId, 5);
}

async function getTransactionById(id) {
  const { rows } = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
  return mapTransaction(rows[0]);
}

/**
 * Busca a transação PENDING de depósito vinculada a uma cobrança PIX pelo
 * charge.id embutido na descrição (`[<id>]`). Query direcionada SEM limite de
 * 50 — evita o furo lógico de não encontrar cobranças antigas num usuário
 * com muitas movimentações.
 */
async function getPendingDepositTxnByCharge(userId, chargeId) {
  const { rows } = await pool.query(
    `SELECT * FROM transactions
     WHERE user_id = $1 AND type = 'deposit' AND status = 'pending'
       AND description LIKE $2
     ORDER BY date ASC LIMIT 1`,
    [userId, `%[${chargeId}]%`]
  );
  return mapTransaction(rows[0]);
}

/** Atualiza o status de uma transação (ex.: saque pending → completed). */
async function updateTransactionStatus(id, status) {
  const { rows } = await pool.query(
    'UPDATE transactions SET status = $1 WHERE id = $2 RETURNING *', [status, id]
  );
  return mapTransaction(rows[0]);
}

/** Saques pendentes (com dados do usuário) — painel do admin. */
async function getPendingWithdrawals() {
  const { rows } = await pool.query(
    `SELECT t.*, u.name AS user_name, u.email AS user_email
     FROM transactions t JOIN users u ON u.id = t.user_id
     WHERE t.type = 'withdrawal' AND t.status = 'pending'
     ORDER BY t.date DESC`
  );
  return rows.map(r => ({ ...mapTransaction(r), userName: r.user_name, userEmail: r.user_email }));
}

// ==================== PIX CHARGES (DEPÓSITOS) ====================

function mapPixCharge(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    payload: row.payload,
    qrCode: row.qr_code,
    qrCodeBase64: row.qr_code_base64,
    txid: row.txid,
    status: row.status,
    expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    paidAt: row.paid_at ? row.paid_at.toISOString() : null,
    confirmedAt: row.confirmed_at ? row.confirmed_at.toISOString() : null,
    confirmedBy: row.confirmed_by,
    createdAt: row.created_at ? row.created_at.toISOString() : null
  };
}

async function createPixCharge(charge) {
  await pool.query(
    `INSERT INTO pix_charges (id, user_id, amount, payload, qr_code, qr_code_base64, txid, status, expires_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [charge.id, charge.userId, charge.amount, charge.payload, charge.qrCode, charge.qrCodeBase64,
     charge.txid, charge.status, charge.expiresAt, charge.createdAt]
  );
  return getPixChargeById(charge.id);
}

async function getPixChargeById(id) {
  const { rows } = await pool.query('SELECT * FROM pix_charges WHERE id = $1', [id]);
  return mapPixCharge(rows[0]);
}

async function getUserPixCharges(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM pix_charges WHERE user_id = $1 ORDER BY created_at DESC', [userId]
  );
  return rows.map(mapPixCharge);
}

async function updatePixCharge(id, fields) {
  const allowed = ['status', 'paid_at', 'confirmed_at', 'confirmed_by'];
  const sets = [];
  const params = [id];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${params.length + 1}`);
      params.push(fields[key]);
    }
  }
  if (sets.length === 0) return getPixChargeById(id);
  const { rows } = await pool.query(
    `UPDATE pix_charges SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params
  );
  return mapPixCharge(rows[0]);
}

/**
 * Confirma uma cobrança PIX de forma ATÔMICA: `UPDATE ... WHERE status='pending'`
 * retorna a cobrança atualizada se a transição foi feita, ou null se já
 * processada. Fecha o TOCTOU (check-then-act) entre a leitura e o update no
 * confirm — duas confirmações concorrentes não creditam saldo duas vezes.
 */
async function confirmPixCharge(id, confirmedBy) {
  const { rows } = await pool.query(
    `UPDATE pix_charges
     SET status = 'paid', paid_at = NOW(), confirmed_at = NOW(), confirmed_by = $2
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [id, confirmedBy]
  );
  return mapPixCharge(rows[0]);
}

/** Cancela uma cobrança PIX de forma atômica (idempotente). */
async function cancelPixCharge(id) {
  const { rows } = await pool.query(
    `UPDATE pix_charges SET status = 'canceled'
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [id]
  );
  return mapPixCharge(rows[0]);
}

/** Cobranças PIX pendentes (com dados do usuário) — painel do admin. */
async function getPendingPixCharges() {
  const { rows } = await pool.query(
    `SELECT p.*, u.name AS user_name, u.email AS user_email
     FROM pix_charges p JOIN users u ON u.id = p.user_id
     WHERE p.status = 'pending'
     ORDER BY p.created_at DESC`
  );
  return rows.map(r => ({ ...mapPixCharge(r), userName: r.user_name, userEmail: r.user_email }));
}

// ==================== DADOS BANCÁRIOS (SAQUES) ====================

function mapBankDetail(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    chavePix: row.chave_pix,
    bancoNome: row.banco_nome,
    bancoCodigo: row.banco_codigo,
    agencia: row.agencia,
    conta: row.conta,
    tipoConta: row.tipo_conta,
    titularNome: row.titular_nome,
    cpfCnpj: row.cpf_cnpj,
    verificado: row.verificado,
    createdAt: row.created_at ? row.created_at.toISOString() : null
  };
}

async function createBankDetail(detail) {
  await pool.query(
    `INSERT INTO bank_details (id, user_id, chave_pix, banco_nome, banco_codigo, agencia, conta, tipo_conta, titular_nome, cpf_cnpj, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [detail.id, detail.userId, detail.chavePix, detail.bancoNome, detail.bancoCodigo,
     detail.agencia, detail.conta, detail.tipoConta, detail.titularNome, detail.cpfCnpj, detail.createdAt]
  );
  return getBankDetailById(detail.id, detail.userId);
}

async function getUserBankDetails(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM bank_details WHERE user_id = $1 ORDER BY created_at DESC', [userId]
  );
  return rows.map(mapBankDetail);
}

async function getBankDetailById(id, userId) {
  const { rows } = await pool.query(
    'SELECT * FROM bank_details WHERE id = $1 AND user_id = $2', [id, userId]
  );
  return mapBankDetail(rows[0]);
}

async function deleteBankDetail(id, userId) {
  await pool.query('DELETE FROM bank_details WHERE id = $1 AND user_id = $2', [id, userId]);
}

// ==================== BETS ====================

async function getUserBets(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM bets WHERE user_id = $1 ORDER BY date DESC', [userId]
  );
  return rows.map(mapBet);
}

async function addBet(bet) {
  await pool.query(
    `INSERT INTO bets (id, user_id, game_type, numbers, amount, date, status, game_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [bet.id, bet.userId, bet.gameType, safeStringify(bet.numbers), bet.amount, bet.date, bet.status, bet.gameId || null]
  );
  return bet;
}

// ==================== NOTIFICATIONS ====================

async function getUserNotifications(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId]
  );
  return rows.map(mapNotification);
}

async function addNotification(notif) {
  await pool.query(
    `INSERT INTO notifications (id, user_id, type, title, message, link, read, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [notif.id, notif.userId, notif.type, notif.title, notif.message,
     notif.link, notif.read, notif.createdAt]
  );
}

async function markNotificationRead(id, userId) {
  await pool.query(
    'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2', [id, userId]
  );
}

async function markAllNotificationsRead(userId) {
  await pool.query('UPDATE notifications SET read = TRUE WHERE user_id = $1', [userId]);
}

// ==================== SUBSCRIPTIONS ====================

async function getAllSubscriptions() {
  const { rows } = await pool.query('SELECT * FROM subscriptions ORDER BY created_at ASC');
  return rows.map(mapSubscription);
}

async function getUserSubscriptions(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at ASC', [userId]
  );
  return rows.map(mapSubscription);
}

async function getActiveSubscriptions() {
  const { rows } = await pool.query(
    'SELECT * FROM subscriptions WHERE active = TRUE ORDER BY created_at ASC'
  );
  return rows.map(mapSubscription);
}

async function createSubscription(sub) {
  await pool.query(
    `INSERT INTO subscriptions (id, user_id, user_name, game_type, numbers, name, game_id, interval, active, next_contest, last_executed, total_executions, total_spent, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (id) DO UPDATE SET
       active = EXCLUDED.active,
       total_executions = EXCLUDED.total_executions,
       total_spent = EXCLUDED.total_spent,
       next_contest = EXCLUDED.next_contest`,
    [sub.id, sub.userId, sub.userName, sub.gameType, safeStringify(sub.numbers), sub.name,
     sub.gameId, sub.interval, sub.active, sub.nextContest, sub.lastExecuted,
     sub.totalExecutions, sub.totalSpent, sub.createdAt]
  );
  return getUserSubscriptions(sub.userId);
}

async function updateSubscription(id, fields) {
  const allowed = ['active'];
  const sets = [];
  const params = [id];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${params.length + 1}`);
      params.push(fields[key]);
    }
  }
  if (fields.lastExecuted !== undefined) { sets.push(`last_executed = $${params.length + 1}`); params.push(fields.lastExecuted); }
  if (fields.totalExecutions !== undefined) { sets.push(`total_executions = $${params.length + 1}`); params.push(fields.totalExecutions); }
  if (fields.totalSpent !== undefined) { sets.push(`total_spent = $${params.length + 1}`); params.push(fields.totalSpent); }
  if (fields.nextContest !== undefined) { sets.push(`next_contest = $${params.length + 1}`); params.push(fields.nextContest); }
  if (sets.length === 0) return null;
  await pool.query(`UPDATE subscriptions SET ${sets.join(', ')} WHERE id = $1`, params);
}

// ==================== ACHIEVEMENTS ====================

async function getUserAchievementIds(userId) {
  const { rows } = await pool.query(
    'SELECT achievement_id FROM user_achievements WHERE user_id = $1', [userId]
  );
  return rows.map(r => r.achievement_id);
}

async function addUserAchievement(userId, achievementId) {
  await pool.query(
    `INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1,$2)
     ON CONFLICT DO NOTHING`, [userId, achievementId]
  );
}

// ==================== RESULTS (CACHE DE CONCURSOS) ====================

async function getResults() {
  const { rows } = await pool.query('SELECT payload FROM results ORDER BY numero ASC');
  return rows.map(r => r.payload);
}

/** Total de concursos salvos (para a hidratação progressiva do cache). */
async function getResultsCount() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM results');
  return rows[0] ? rows[0].total : 0;
}

/**
 * Carrega uma janela paginada de concursos em ordem crescente de numero.
 * Usado pela hidratação progressiva: busca os "próximos" lotes em background
 * (ORDER BY numero DESC + OFFSET é rápido no Postgres graças ao PK).
 */
async function getResultsWindow(limit, offset = 0) {
  const { rows } = await pool.query(
    'SELECT payload FROM results ORDER BY numero DESC LIMIT $1 OFFSET $2', [limit, offset]
  );
  return rows.map(r => r.payload).reverse(); // volta para ordem crescente
}

/**
 * Carrega apenas os últimos N resultados (para o cache do serverless).
 * Carregar os 3740 concursos inteiros leva ~13s — estoura o limite de duração
 * das funções do Vercel (Hobby ~10s) e o bootstrap nunca completa.
 */
async function getRecentResults(limit = 500) {
  const { rows } = await pool.query(
    'SELECT payload FROM results ORDER BY numero DESC LIMIT $1', [limit]
  );
  return rows.map(r => r.payload).reverse();
}

async function getResultByNumero(numero) {
  const { rows } = await pool.query('SELECT payload FROM results WHERE numero = $1', [numero]);
  return rows[0] ? rows[0].payload : null;
}

async function getLatestResult() {
  const { rows } = await pool.query(
    'SELECT payload FROM results ORDER BY numero DESC LIMIT 1'
  );
  return rows[0] ? rows[0].payload : null;
}

async function saveResult(payload) {
  if (!payload || !payload.numero) return;
  await pool.query(
    `INSERT INTO results (numero, payload) VALUES ($1,$2)
     ON CONFLICT (numero) DO UPDATE SET payload = EXCLUDED.payload`,
    [payload.numero, safeStringify(payload)]
  );
}

// ==================== SEEDS (EVOLUÇÃO DA IA) ====================

async function getSeed(gameType) {
  const { rows } = await pool.query('SELECT payload FROM seeds WHERE game_type = $1', [gameType]);
  return rows[0] ? rows[0].payload : null;
}

async function saveSeed(gameType, payload) {
  await pool.query(
    `INSERT INTO seeds (game_type, payload, updated_at) VALUES ($1,$2,NOW())
     ON CONFLICT (game_type) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [gameType, safeStringify(payload)]
  );
}

// ==================== CONFIG DE LOTERIAS (ADMIN) ====================

/** Retorna todos os overrides de preço: [{ gameType, prices: {pick: price} }] */
async function getLotteryConfigs() {
  const { rows } = await pool.query('SELECT game_type, prices, updated_at FROM lottery_config');
  return rows.map(r => ({
    gameType: r.game_type,
    prices: r.prices,
    updatedAt: r.updated_at
  }));
}

/** Salva (upsert) o override de preço de um tipo de jogo. */
async function saveLotteryConfig(gameType, prices) {
  await pool.query(
    `INSERT INTO lottery_config (game_type, prices, updated_at) VALUES ($1,$2,NOW())
     ON CONFLICT (game_type) DO UPDATE SET prices = EXCLUDED.prices, updated_at = NOW()`,
    [gameType, safeStringify(prices)]
  );
}

// ==================== EXPORTAÇÃO ====================

module.exports = {
  pool,
  ensureSchema,
  // users
  getUserById, getUserByEmail, getUserByName, createUser, updateUser,
  adjustUserBalance, adjustUserWinnings,
  // games
  getUserGames, getGameById, createGame, updateGame, deleteGame, getAllGames,
  // pools
  getPools, getPoolById, createPool, updatePool,
  // transactions
  getUserTransactions, addTransaction, getTransactionById, updateTransactionStatus,
  getPendingWithdrawals, getPendingDepositTxnByCharge,
  // pix charges (depósitos)
  createPixCharge, getPixChargeById, getUserPixCharges, updatePixCharge,
  confirmPixCharge, cancelPixCharge, getPendingPixCharges,
  // dados bancários (saques)
  createBankDetail, getUserBankDetails, getBankDetailById, deleteBankDetail,
  // bets
  getUserBets, addBet,
  // config de loterias
  getLotteryConfigs, saveLotteryConfig,
  // notifications
  getUserNotifications, addNotification, markNotificationRead, markAllNotificationsRead,
  // subscriptions
  getAllSubscriptions, getUserSubscriptions, getActiveSubscriptions,
  createSubscription, updateSubscription,
  // achievements
  getUserAchievementIds, addUserAchievement,
  // results
  getResults, getResultsCount, getResultsWindow, getRecentResults,
  getResultByNumero, getLatestResult, saveResult,
  // seeds
  getSeed, saveSeed,
  isNeon
};
