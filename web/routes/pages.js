/**
 * routes/pages.js — Páginas (render EJS), extraído do server.js.
 */
const { asyncRouter } = require('../lib/http');
const { requireAuth } = require('../lib/auth');

const router = asyncRouter();

// Todas as páginas protegidas por autenticação
router.get('/', requireAuth, (req, res) => {
  res.render('dashboard', { title: 'Dashboard', page: 'dashboard', user: req.currentUser });
});

router.get('/apostas', requireAuth, (req, res) => {
  res.render('bets', { title: 'Apostas', page: 'bets', user: req.currentUser, subtitle: 'Escolha seus números da sorte' });
});

router.get('/carteira', requireAuth, (req, res) => {
  res.render('wallet', { title: 'Carteira', page: 'wallet', user: req.currentUser, subtitle: 'Gerencie seu saldo e transações' });
});

router.get('/boloes', requireAuth, (req, res) => {
  res.render('pools', { title: 'Bolões', page: 'pools', user: req.currentUser, subtitle: 'Crie ou participe de bolões' });
});

router.get('/simulacao', requireAuth, (req, res) => {
  res.render('simulation', { title: 'Simulação com IA', page: 'simulation', user: req.currentUser, subtitle: 'Use inteligência artificial para analisar seus jogos' });
});

router.get('/resultados', requireAuth, (req, res) => {
  res.render('results', { title: 'Resultados', page: 'results', user: req.currentUser, subtitle: 'Resultados oficiais da Lotofácil' });
});

router.get('/perfil', requireAuth, (req, res) => {
  res.render('profile', { title: 'Perfil', page: 'profile', user: req.currentUser, subtitle: 'Suas informações pessoais' });
});

router.get('/meus-jogos', requireAuth, (req, res) => {
  res.render('my-games', { title: 'Meus Jogos', page: 'my-games', user: req.currentUser, subtitle: 'Gerencie seu portfólio de jogos' });
});

router.get('/configuracoes', requireAuth, (req, res) => {
  res.render('settings', { title: 'Configurações', page: 'settings', user: req.currentUser, subtitle: 'Personalize sua experiência' });
});

router.get('/estatisticas', requireAuth, (req, res) => {
  res.render('stats', {
    title: 'Estatísticas Avançadas', page: 'stats', user: req.currentUser,
    subtitle: '📊 Análise detalhada dos resultados históricos'
  });
});

module.exports = router;
