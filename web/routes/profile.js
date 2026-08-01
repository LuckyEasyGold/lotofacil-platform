/**
 * routes/profile.js — Perfil do usuário, extraído do server.js.
 */
const db = require('../db');
const { asyncRouter } = require('../lib/http');
const { requireAuth, sanitizeUser } = require('../lib/auth');
const { validate, updateProfileSchema } = require('../lib/validation');

const router = asyncRouter();

/** PUT /api/profile — Atualizar dados do perfil */
router.put('/api/profile', requireAuth, validate(updateProfileSchema), async (req, res) => {
  const { name, email } = req.body;
  const fields = {};
  if (name) fields.name = name;
  if (email) fields.email = email;
  await db.updateUser(req.currentUser.id, fields);
  const updated = await db.getUserById(req.currentUser.id);
  res.json({ success: true, user: sanitizeUser(updated) });
});

module.exports = router;
