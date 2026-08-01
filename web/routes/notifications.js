/**
 * routes/notifications.js — Notificações, extraído do server.js.
 */
const db = require('../db');
const { asyncRouter } = require('../lib/http');
const { requireAuth } = require('../lib/auth');

const router = asyncRouter();

/** GET /api/notifications — Listar notificações do usuário */
router.get('/api/notifications', requireAuth, async (req, res) => {
  const notifs = await db.getUserNotifications(req.currentUser.id);
  res.json({
    notifications: notifs.slice(0, 20),
    unread: notifs.filter(n => !n.read).length,
    total: notifs.length
  });
});

/** POST /api/notifications/read-all — Marcar todas como lidas */
router.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  await db.markAllNotificationsRead(req.currentUser.id);
  res.json({ success: true });
});

/** POST /api/notifications/:id/read — Marcar uma como lida */
router.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
  await db.markNotificationRead(req.params.id, req.currentUser.id);
  res.json({ success: true });
});

module.exports = router;
