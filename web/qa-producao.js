/**
 * _qa_real.js — QA REAL contra o banco de PRODUÇÃO (DATABASE_URL do .env.local).
 *
 * Diferente da suíte (que usa banco isolado / TEST_DATABASE_URL), este script
 * usa o MESMO banco de produção e verifica via SQL se cada ação realmente
 * gravou no Postgres:
 *   1. registra usuário QA → verifica linha em users
 *   2. depósito → verifica saldo + transactions
 *   3. cria jogo → verifica linha em games
 *   4. cria bolão → verifica linha em pools
 *   5. aposta → verifica linha em bets + game vinculado usado
 *   6. IA generate → verifica retorno de jogos
 *   7. results/latest → verifica retorno do último concurso
 *   8. results/history → verifica retorno do histórico
 *   9. notificações → verifica criação
 * Limpa os dados de teste ao final (não polui o banco real).
 *
 * Uso: node _qa_real.js
 */
require('dotenv').config({ path: '.env.local', override: true, quiet: true });
process.env.NODE_ENV = 'test'; // cookie secure off p/ supertest HTTP
process.env.VERCEL = '1';       // exporta app sem abrir porta (igual à suíte)

const request = require('supertest');
const app = require('./server');
const db = require('./db');

const results = [];
let qaUser = null;
let qaAgent = null;
let qaPoolId = null;

// Se BASE_URL for informada, testa o CÓDIGO DEPLOYADO (ex.: Vercel) via HTTPS.
// Sem BASE_URL, testa o código local contra o mesmo banco de produção.
const BASE_URL = process.env.BASE_URL || null;

function report(ok, label, detail = '') {
  results.push({ ok, label, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${label}${detail ? ' | ' + detail : ''}`);
}

async function sql(label, sql, params = []) {
  const { rows } = await db.pool.query(sql, params);
  report(true, `DB ${label}`, `${rows.length} linha(s)`);
  return rows;
}

async function main() {
  const email = `qa_real_${Date.now()}@test.com`;
  console.log('=== QA REAL contra banco de PRODUÇÃO ===');
  console.log(`Banco: ${db.isNeon ? 'Neon' : 'local'} | Usuário QA: ${email}\n`);

  // ---------- 1. Registro ----------
  // Sem BASE_URL usa o app local (supertest no Express); com BASE_URL usa o
  // servidor remoto (endereço HTTPS do deploy) — testa o código em produção.
  qaAgent = BASE_URL ? request.agent(BASE_URL) : request.agent(app);
  const reg = await qaAgent.post('/api/auth/register').send({
    name: 'QA Real', email, password: 'senha-qa-123'
  });
  if (reg.status !== 200 || !reg.body.success) {
    report(false, 'Registro', `HTTP ${reg.status} ${JSON.stringify(reg.body)}`);
    return;
  }
  qaUser = reg.body.user;
  report(true, 'Registro', `id=${qaUser.id}`);
  const users = await sql('users', 'SELECT id,email,balance,role FROM users WHERE id=$1', [qaUser.id]);
  if (users[0] && users[0].balance === 0) report(true, 'Saldo inicial 0');

  // ---------- 2. Depósito ----------
  const dep = await qaAgent.post('/api/wallet/deposit').send({ amount: 200 });
  report(dep.status === 200 && dep.body.balance === 200, 'Depósito R$200',
    `saldo=${dep.body && dep.body.balance}`);
  await sql('transactions', 'SELECT type,amount FROM transactions WHERE user_id=$1', [qaUser.id]);

  // ---------- 3. Criar jogo ----------
  const quinze = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
  const game = await qaAgent.post('/api/games').send({
    gameType: 'LOTOFACIL', numbers: quinze, name: 'QA Jogo Real', source: 'manual'
  });
  report(game.status === 200 && game.body.success, 'Criar jogo', `id=${game.body.game && game.body.game.id}`);
  const gameId = game.body.game ? game.body.game.id : null;
  if (gameId) {
    const g = await sql('games', 'SELECT id,user_id,numbers,status FROM games WHERE id=$1', [gameId]);
    const numbersOk = g[0] && JSON.stringify(g[0].numbers) === JSON.stringify(quinze);
    report(numbersOk, 'Jogo gravado no banco com números corretos',
      g[0] ? `status=${g[0].status} numeros=${JSON.stringify(g[0].numbers)}` : 'NÃO ENCONTRADO');
  }

  // ---------- 4. Criar bolão ----------
  const pool = await qaAgent.post('/api/pools').send({
    name: 'QA Bolão Real', gameType: 'LOTOFACIL', contestNumber: 3005,
    totalShares: 10, sharePrice: 10, numbers: quinze
  });
  report(pool.status === 200 && pool.body.success, 'Criar bolão', `id=${pool.body.pool && pool.body.pool.id}`);
  qaPoolId = pool.body.pool ? pool.body.pool.id : null;
  if (qaPoolId) {
    report(pool.body.pool.availableShares === 9, 'Bolão: availableShares = 9 (10 - 1 do criador)', `= ${pool.body.pool.availableShares}`);
    const p = await sql('pools', 'SELECT id,name,share_price,total_shares,status FROM pools WHERE id=$1', [qaPoolId]);
    report(!!p[0], 'Bolão gravado no banco', p[0] ? `${p[0].name} R$${p[0].share_price} ${p[0].status}` : 'NÃO ENCONTRADO');
  }

  // ---------- 5. Apostar (vincula o jogo) ----------
  const bet = await qaAgent.post('/api/bets').send({
    gameType: 'LOTOFACIL', numbers: quinze, amount: 3, gameId
  });
  report(bet.status === 200, 'Aposta (15 dezenas)', `HTTP ${bet.status} amount=${bet.body.amount}`);
  report(bet.status === 200 && bet.body.amount === 3, 'Preço oficial 15 dezenas = R$ 3,00', `amount=${bet.body.amount}`);
  const bets = await sql('bets', 'SELECT id,game_type,amount,game_id FROM bets WHERE user_id=$1', [qaUser.id]);
  report(bets.length === 1 && bets[0].game_id === gameId, 'Aposta gravada no banco com game_id vinculado',
    bets[0] ? `game_id=${bets[0].game_id}` : 'NENHUMA');
  const gameAfter = await db.getGameById(gameId, qaUser.id);
  report(gameAfter && gameAfter.status === 'used' && gameAfter.usageHistory.length === 1,
    'Jogo marcado como usado no banco', gameAfter ? `status=${gameAfter.status} usos=${gameAfter.usageHistory.length}` : '—');

  // ---------- 6. IA generate ----------
  const ai = await qaAgent.get('/api/ai/generate?quantity=3');
  const aiGames = ai.body && ai.body.games;
  report(ai.status === 200 && Array.isArray(aiGames) && aiGames.length === 3,
    'IA gerar 3 jogos', `status=${ai.status} jogos=${aiGames ? aiGames.length : '?'} seed=${ai.body && ai.body.seed_version}`);

  // ---------- 7. Results latest ----------
  const latest = await qaAgent.get('/api/results/latest');
  const hasLatest = latest.status === 200 && latest.body && latest.body.listaDezenas;
  report(hasLatest, 'Resultado mais recente',
    hasLatest ? `concurso #${latest.body.numero} dezenas=${latest.body.listaDezenas.length} data=${latest.body.dataApuracao || '?'}` : `HTTP ${latest.status} ${JSON.stringify(latest.body)}`);

  // ---------- 8. Results history ----------
  const hist = await qaAgent.get('/api/results/history/recent?limit=10');
  report(hist.status === 200 && Array.isArray(hist.body) && hist.body.length > 0,
    'Histórico de resultados', `HTTP ${hist.status} concursos=${hist.body ? hist.body.length : '?'}`);

  // ---------- 9. Notificações ----------
  const notif = await qaAgent.get('/api/notifications');
  const ntypes = notif.body && notif.body.notifications ? notif.body.notifications.map(n => n.type) : [];
  report(notif.status === 200 && ntypes.length >= 3,
    'Notificações criadas (wallet/bet/pool)', `types=[${ntypes.join(',')}] unread=${notif.body && notif.body.unread}`);

  // ---------- 10. Banco de resultados: total de concursos ----------
  const stats = await qaAgent.get('/api/database/stats');
  report(stats.status === 200, 'Stats do banco de resultados',
    stats.body ? `total=${stats.body.total} primeiro=#${stats.body.first} último=#${stats.body.last}` : JSON.stringify(stats.body));

  console.log('\n=== RESUMO ===');
  const fails = results.filter(r => !r.ok);
  console.log(`PASS: ${results.length - fails.length} | FAIL: ${fails.length}`);
  if (fails.length) {
    console.log('\nFalhas:');
    fails.forEach(f => console.log(`  ✗ ${f.label} — ${f.detail}`));
  }
}

async function cleanup() {
  if (!qaUser) return;
  console.log('\n=== LIMPEZA ===');
  const id = qaUser.id;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of ['games', 'transactions', 'bets', 'notifications', 'subscriptions', 'user_achievements']) {
      const r = await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [id]);
      if (r.rowCount > 0) console.log(`  - ${table}: ${r.rowCount} linha(s) apagadas`);
    }
    const r = await client.query('DELETE FROM users WHERE id = $1', [id]);
    console.log(`  - users: ${r.rowCount} linha(s) apagadas`);
    // Bolão: apaga SOMENTE o que este QA criou (por ID único), nunca por nome
    if (qaPoolId) {
      const pools = await client.query('DELETE FROM pools WHERE id = $1', [qaPoolId]);
      if (pools.rowCount > 0) console.log(`  - pools: ${pools.rowCount} linha(s) apagadas`);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('  ERRO na limpeza:', e.message);
  } finally {
    client.release();
    await db.pool.end().catch(() => {});
  }
}

main()
  .catch(e => { console.error('ERRO FATAL:', e.message); process.exitCode = 1; })
  .finally(() => cleanup().then(() => process.exit(process.exitCode || (results.some(r => !r.ok) ? 1 : 0))));
