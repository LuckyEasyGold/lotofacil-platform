/**
 * lib/gamification.js — Conquistas e nível do usuário (extraído do server.js).
 */
const db = require('../db');
const { addNotification } = require('./notifications');

// Conquistas disponíveis
const ACHIEVEMENTS = [
  { id: 'first_game', name: '🎯 Primeiro Jogo', desc: 'Crie seu primeiro jogo', icon: 'fa-bullseye' },
  { id: 'five_games', name: '🎲 Sortudo', desc: 'Crie 5 jogos no portfólio', icon: 'fa-dice' },
  { id: 'ten_games', name: '🏆 Veterano', desc: 'Crie 10 jogos no portfólio', icon: 'fa-trophy' },
  { id: 'twenty_games', name: '💎 Mestre dos Números', desc: 'Crie 20 jogos no portfólio', icon: 'fa-gem' },
  { id: 'ai_first', name: '🤖 Iniciação IA', desc: 'Use a IA pela primeira vez', icon: 'fa-robot' },
  { id: 'ai_five', name: '🧠 Mente Digital', desc: 'Use a IA 5 vezes', icon: 'fa-brain' },
  { id: 'pool_first', name: '👥 União', desc: 'Participe de um bolão pela primeira vez', icon: 'fa-users' },
  { id: 'pool_five', name: '🤝 Social', desc: 'Participe de 5 bolões', icon: 'fa-handshake' },
  { id: 'win_first', name: '🏅 Primeiro Prêmio', desc: 'Ganhe seu primeiro prêmio', icon: 'fa-medal' },
  { id: 'win_five', name: '🥇 Premiado', desc: 'Ganhe 5 prêmios', icon: 'fa-crown' },
  { id: 'hit_14', name: '🔥 Quase Lá', desc: 'Faça 14 acertos em um concurso', icon: 'fa-fire' },
  { id: 'hit_15', name: '🌟 Lendário', desc: 'Faça 15 acertos (Lotofácil)!', icon: 'fa-star' },
  { id: 'export_first', name: '📥 Exportador', desc: 'Exporte seu portfólio pela primeira vez', icon: 'fa-download' },
  { id: 'subscribe_first', name: '🔄 Assinante', desc: 'Crie sua primeira assinatura', icon: 'fa-repeat' },
  { id: 'share_first', name: '📢 Influenciador', desc: 'Compartilhe um jogo', icon: 'fa-share-alt' },
  { id: 'subscription_10', name: '📅 Fiel', desc: 'Acumule 10 apostas automáticas via assinatura', icon: 'fa-calendar-check' },
];

/** Nível do usuário baseado em XP */
async function getUserLevel(userId) {
  let xp = 0;
  const userGs = await db.getUserGames(userId);
  const userAchievementIds = await db.getUserAchievementIds(userId);
  xp += userGs.length * 10;
  xp += userGs.reduce((s, g) => s + g.usageHistory.length, 0) * 5;
  xp += userGs.reduce((s, g) => s + g.usageHistory.reduce((s2, u) => s2 + (u.hits || 0), 0), 0) * 3;
  xp += userAchievementIds.length * 50;
  const level = Math.floor(xp / 100) + 1;
  const nextLevelXp = level * 100;
  return {
    level,
    xp,
    nextLevelXp,
    progress: Math.min((xp / nextLevelXp) * 100, 100),
    title: level >= 50 ? 'Lendário' : level >= 30 ? 'Mestre' : level >= 15 ? 'Veterano' : level >= 5 ? 'Experiente' : 'Iniciante',
    achievements: userAchievementIds.map(id => ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean)
  };
}

/** Verificar e conceder conquistas */
async function checkAchievements(userId) {
  const userAchievementIds = await db.getUserAchievementIds(userId);
  const userGs = await db.getUserGames(userId);
  const totalGames = userGs.length;
  const totalUsed = userGs.reduce((s, g) => s + g.usageHistory.length, 0);
  const aiGames = userGs.filter(g => g.source === 'ai').length;
  const wonGames = userGs.filter(g => g.status === 'won');
  const maxHits = Math.max(0, ...userGs.flatMap(g => g.usageHistory.map(u => u.hits || 0)));
  const pools = await db.getPools();
  const user = await db.getUserById(userId);
  const poolPartCount = pools.filter(p => p.participants.some(pp => pp.name === user?.name)).length;
  const userSubs = await db.getUserSubscriptions(userId);
  const totalExecs = userSubs.reduce((s, sub) => s + sub.totalExecutions, 0);

  const checks = [
    { id: 'first_game', check: totalGames >= 1 },
    { id: 'five_games', check: totalGames >= 5 },
    { id: 'ten_games', check: totalGames >= 10 },
    { id: 'twenty_games', check: totalGames >= 20 },
    { id: 'ai_first', check: aiGames >= 1 },
    { id: 'ai_five', check: aiGames >= 5 },
    { id: 'pool_first', check: poolPartCount >= 1 },
    { id: 'pool_five', check: poolPartCount >= 5 },
    { id: 'win_first', check: wonGames.length >= 1 },
    { id: 'win_five', check: wonGames.length >= 5 },
    { id: 'hit_14', check: maxHits >= 14 },
    { id: 'hit_15', check: maxHits >= 15 },
    { id: 'subscribe_first', check: userSubs.some(s => s.active) },
    { id: 'subscription_10', check: totalExecs >= 10 },
  ];

  let newAchievements = [];
  for (const c of checks) {
    if (c.check && !userAchievementIds.includes(c.id)) {
      await db.addUserAchievement(userId, c.id);
      newAchievements.push(ACHIEVEMENTS.find(a => a.id === c.id));
    }
  }

  if (newAchievements.length > 0) {
    await addNotification(userId, 'prize', '🏅 Nova conquista!',
      `Você desbloqueou: ${newAchievements.map(a => a.name).join(', ')}!`,
      '/perfil');
  }
}

module.exports = { ACHIEVEMENTS, getUserLevel, checkAchievements };
