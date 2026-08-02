/**
 * routes/share.js — Compartilhamento social, extraído do server.js.
 */
const db = require('../db');
const { asyncRouter } = require('../lib/http');
const { requireAuth } = require('../lib/auth');
const { LOTTERY_CONFIGS } = require('../lib/lottery');
const { formatBRL } = require('../lib/format');

const router = asyncRouter();

/** POST /api/share/game — Compartilhar um jogo */
router.post('/api/share/game', requireAuth, async (req, res) => {
  const user = req.currentUser;
  const { gameId, platform } = req.body;
  const game = await db.getGameById(gameId, user.id);
  if (!game) return res.status(404).json({ error: 'Jogo não encontrado' });

  const shareText = `🎲 Meu jogo da ${LOTTERY_CONFIGS[game.gameType]?.name || 'Lotofácil'}: ${game.numbers.join(', ')}! Jogue comigo na Lotofácil Platform! 🍀`;
  const shareUrl = process.env.SITE_URL || 'https://lotofacil.local/meus-jogos';
  const encoded = encodeURIComponent(shareText + ' ' + shareUrl);

  let shareLink;
  switch (platform) {
    case 'whatsapp': shareLink = `https://wa.me/?text=${encoded}`; break;
    case 'telegram': shareLink = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`; break;
    case 'twitter': shareLink = `https://twitter.com/intent/tweet?text=${encoded}`; break;
    case 'facebook': shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`; break;
    default: shareLink = `https://wa.me/?text=${encoded}`; break;
  }

  const achievements = await db.getUserAchievementIds(user.id);
  if (!achievements.includes('share_first')) {
    await db.addUserAchievement(user.id, 'share_first');
  }

  res.json({ success: true, shareLink, shareText });
});

/** POST /api/share/pool — Compartilhar um bolão */
router.post('/api/share/pool', requireAuth, async (req, res) => {
  const { poolId } = req.body;
  const pool = await db.getPoolById(poolId);
  if (!pool) return res.status(404).json({ error: 'Bolão não encontrado' });

  const shareText = `👥 Participe do bolão "${pool.name}" na Lotofácil Platform! ${pool.availableShares} cotas disponíveis a ${formatBRL(pool.sharePrice)}! 🍀`;
  const shareUrl = process.env.SITE_URL || 'https://lotofacil.local/boloes';
  const encoded = encodeURIComponent(shareText + ' ' + shareUrl);

  let shareLink = `https://wa.me/?text=${encoded}`;
  res.json({ success: true, shareLink, shareText });
});

module.exports = router;
