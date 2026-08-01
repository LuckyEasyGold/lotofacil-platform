/**
 * routes/auth.js — Autenticação (páginas + API), extraído do server.js.
 * Payloads validados com Zod (lib/validation.js).
 */
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { asyncRouter } = require('../lib/http');
const { getSessionUser, sanitizeUser } = require('../lib/auth');
const { validate, registerSchema, loginSchema } = require('../lib/validation');

const router = asyncRouter();

/** GET /login — Página de login */
router.get('/login', async (req, res) => {
  const user = await getSessionUser(req);
  if (user) return res.redirect('/');
  res.render('login');
});

/** GET /register — Página de cadastro */
router.get('/register', async (req, res) => {
  const user = await getSessionUser(req);
  if (user) return res.redirect('/');
  res.render('register');
});

/** POST /api/auth/register — Criar nova conta */
router.post('/api/auth/register', validate(registerSchema), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Este e-mail já está cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: uuidv4(),
      name,
      email,
      password: hashedPassword,
      avatar: name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(),
      balance: 0,
      bonusBalance: 50.00, // bônus de boas-vindas
      totalWinnings: 0,
      role: 'user',
      createdAt: new Date().toISOString()
    };

    await db.createUser(newUser);

    req.session.userId = newUser.id;
    res.json({ success: true, user: sanitizeUser(newUser), redirect: '/' });
  } catch (e) {
    console.error('Erro no registro:', e.message);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

/** POST /api/auth/login — Fazer login */
router.post('/api/auth/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, error: 'E-mail ou senha incorretos' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'E-mail ou senha incorretos' });
    }

    req.session.userId = user.id;
    res.json({ success: true, user: sanitizeUser(user), redirect: '/' });
  } catch (e) {
    console.error('Erro no login:', e.message);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

/** POST /api/auth/logout — Sair */
router.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Erro ao sair' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

/** GET /api/auth/me — Dados do usuário logado */
router.get('/api/auth/me', async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: sanitizeUser(user) });
});

module.exports = router;
