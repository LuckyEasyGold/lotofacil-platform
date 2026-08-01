/**
 * migrate.js — Migra os dados dos arquivos JSON locais para o Postgres (Neon).
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node database/migrate.js
 *
 * Importa: users, games, subscriptions, achievements, resultados (lotofacil.json),
 * semente da IA (seeds.json) e cria os bolões iniciais.
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');

const DATA_DIR = __dirname;

async function readJson(name) {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, name), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`⚠️  ${name} não encontrado — pulando`);
    return null;
  }
}

async function main() {
  console.log('=== Migração JSON → Postgres ===\n');

  await db.ensureSchema();
  console.log('✅ Schema garantido\n');

  // ---------- USERS ----------
  const users = await readJson('users.json');
  if (users) {
    let count = 0;
    for (const u of users) {
      const existing = await db.getUserByEmail(u.email);
      if (!existing) {
        await db.createUser({
          id: u.id, name: u.name, email: u.email, password: u.password,
          avatar: u.avatar, balance: u.balance, bonusBalance: u.bonusBalance,
          totalWinnings: u.totalWinnings, role: u.role, createdAt: u.createdAt
        });
        count++;
      }
    }
    console.log(`👤 Usuários: ${count} importados`);
  }

  // ---------- GAMES ----------
  const games = await readJson('games.json');
  if (games) {
    let count = 0;
    for (const g of games) {
      const existing = await db.getGameById(g.id, g.userId);
      if (!existing) {
        await db.createGame({
          id: g.id, userId: g.userId, numbers: g.numbers, gameType: g.gameType,
          name: g.name, source: g.source, seedVersion: g.seedVersion,
          createdAt: g.createdAt, status: g.status,
          usageHistory: g.usageHistory || [], poolId: g.poolId
        });
        count++;
      }
    }
    console.log(`🎮 Jogos: ${count} importados`);
  }

  // ---------- SUBSCRIPTIONS ----------
  const subs = await readJson('subscriptions.json');
  if (subs) {
    let count = 0;
    for (const s of subs) {
      // createSubscription usa ON CONFLICT (id), então é idempotente
      await db.createSubscription({
        id: s.id, userId: s.userId, userName: s.userName, gameType: s.gameType,
        numbers: s.numbers, name: s.name, gameId: s.gameId, interval: s.interval,
        active: s.active, nextContest: s.nextContest, lastExecuted: s.lastExecuted,
        totalExecutions: s.totalExecutions || 0, totalSpent: s.totalSpent || 0,
        createdAt: s.createdAt
      });
      count++;
    }
    console.log(`🔄 Assinaturas: ${count} importadas`);
  }

  // ---------- ACHIEVEMENTS ----------
  const achievements = await readJson('achievements.json');
  if (achievements) {
    let count = 0;
    for (const [userId, ids] of Object.entries(achievements)) {
      for (const id of ids) {
        await db.addUserAchievement(userId, id);
        count++;
      }
    }
    console.log(`🏅 Conquistas: ${count} importadas`);
  }

  // ---------- RESULTADOS (lotofacil.json) ----------
  const results = await readJson('lotofacil.json');
  if (results) {
    let count = 0;
    for (const contest of results) {
      if (contest && contest.numero) {
        await db.saveResult(contest);
        count++;
      }
    }
    console.log(`📊 Resultados: ${count} concursos importados`);
  }

  // ---------- SEMENTE DA IA ----------
  const seed = await readJson('seeds.json');
  if (seed && seed.weights) {
    await db.saveSeed(seed.game_type || 'LOTOFACIL', {
      version: seed.version, game_type: seed.game_type || 'LOTOFACIL',
      weights: seed.weights, generation: seed.generation || 0,
      fitness: seed.fitness || 0, history: seed.history || []
    });
    console.log('🧬 Semente da IA importada');
  }

  // ---------- BOLÕES INICIAIS ----------
  const pools = await db.getPools();
  if (pools.length === 0) {
    await db.createPool({
      id: '974eb2c7-002b-41dc-902b-880d0cc362e3', name: 'Bolão da Sorte', gameType: 'LOTOFACIL', contestNumber: 3005,
      totalShares: 100, availableShares: 45, sharePrice: 25.00, minShares: 1, maxShares: 20,
      numbers: [1,2,5,6,9,10,11,12,15,17,18,19,21,24,25],
      creatorName: 'Maria', status: 'open', createdAt: new Date(),
      participants: [{ name: 'Maria', shares: 10, paid: true }, { name: 'João', shares: 5, paid: true }]
    });
    await db.createPool({
      id: '3f1daf61-8a33-498f-be64-cbd92fdb530e', name: 'Mega Bolão LF', gameType: 'LOTOFACIL', contestNumber: 3006,
      totalShares: 50, availableShares: 20, sharePrice: 50.00, minShares: 1, maxShares: 10,
      numbers: [3,4,7,8,13,14,16,20,22,23,1,5,9,11,25],
      creatorName: 'Carlos', status: 'open', createdAt: new Date(),
      participants: [{ name: 'Carlos', shares: 15, paid: true }]
    });
    console.log('👥 Bolões iniciais criados');
  }

  console.log('\n✅ Migração concluída!');
  process.exit(0);
}

main().catch(e => {
  console.error('❌ Erro na migração:', e.message);
  process.exit(1);
});
