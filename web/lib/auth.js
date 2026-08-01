/**
 * lib/auth.js — Helpers de autenticação/autorização (extraído do server.js).
 */
const db = require('../db');

/** Get the currently logged-in user from session (via Postgres) */
async function getSessionUser(req) {
  if (!req.session.userId) return null;
  try {
    return await db.getUserById(req.session.userId);
  } catch (e) {
    return null;
  }
}

/** Require authentication middleware — redirects to /login if not logged in */
async function requireAuth(req, res, next) {
  try {
    const user = await getSessionUser(req);
    if (user) {
      req.currentUser = user;
      return next();
    }
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    return res.redirect('/login');
  } catch (e) {
    return next(e);
  }
}

/** Require admin role middleware — must be used AFTER requireAuth */
function requireAdmin(req, res, next) {
  if (req.currentUser && req.currentUser.role === 'admin') {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(403).json({ error: 'Acesso negado - necessário perfil admin' });
  }
  res.status(403).render('dashboard', {
    title: 'Acesso negado', page: 'dashboard', user: req.currentUser || null,
    subtitle: 'Você não tem permissão para acessar esta página'
  });
}

function sanitizeUser(user) {
  return {
    id: user.id, name: user.name, email: user.email,
    avatar: user.avatar, balance: user.balance,
    bonusBalance: user.bonusBalance, totalWinnings: user.totalWinnings,
    role: user.role
  };
}

module.exports = { getSessionUser, requireAuth, requireAdmin, sanitizeUser };
