/**
 * routes/gamification.js — Nível e conquistas, extraído do server.js.
 */
const db = require('../db');
const { asyncRouter } = require('../lib/http');
const { requireAuth } = require('../lib/auth');
const { ACHIEVEMENTS, getUserLevel, checkAchievements } = require('../lib/gamification');

const router = asyncRouter();

/** GET /api/gamification/level — Nível/XP do usuário */
router.get('/api/gamification/level', requireAuth, async (req, res) => {
  await checkAchievements(req.currentUser.id);
  const level = await getUserLevel(req.currentUser.id);
  res.json(level);
});

/** GET /api/gamification/achievements — Conquistas do usuário */
router.get('/api/gamification/achievements', requireAuth, async (req, res) => {
  const userAchievementIds = await db.getUserAchievementIds(req.currentUser.id);
  const all = ACHIEVEMENTS.map(a => ({
    ...a,
    unlocked: userAchievementIds.includes(a.id)
  }));
  res.json({ achievements: all, totalUnlocked: userAchievementIds.length, total: all.length });
});

module.exports = router;
