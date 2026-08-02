// API Service
const API_BASE = '';

const api = {
  // ==================== AUTH ====================
  async login(email, password) {
    return fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    }).then(r => r.json());
  },
  async register(name, email, password) {
    return fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    }).then(r => r.json());
  },
  async logout() {
    return fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' }).then(r => r.json());
  },
  async getMe() {
    return fetch(`${API_BASE}/api/auth/me`).then(r => r.json());
  },

  // ==================== DASHBOARD ====================
  async getDashboard() {
    return fetch(`${API_BASE}/api/dashboard`).then(r => r.json());
  },

  // Wallet
  async getWallet() {
    return fetch(`${API_BASE}/api/wallet`).then(r => r.json());
  },
  async deposit(amount, method) {
    return fetch(`${API_BASE}/api/wallet/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, method })
    }).then(r => r.json());
  },
  async withdraw(amount) {
    return fetch(`${API_BASE}/api/wallet/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    }).then(r => {
      if (!r.ok) return r.json().then(e => { throw new Error(e.error); });
      return r.json();
    });
  },

  // Bets
  async saveBet(gameType, numbers, amount, gameId) {
    const payload = { gameType, numbers, amount };
    if (gameId) payload.gameId = gameId;
    return fetch(`${API_BASE}/api/bets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());
  },
  async getBets() {
    return fetch(`${API_BASE}/api/bets`).then(r => r.json());
  },
  async getMyBets() {
    return fetch(`${API_BASE}/api/bets/my`).then(r => r.json());
  },

  // Pools
  async getPools() {
    return fetch(`${API_BASE}/api/pools`).then(r => r.json());
  },
  async createPool(poolData) {
    return fetch(`${API_BASE}/api/pools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(poolData)
    }).then(r => r.json());
  },
  async joinPool(poolId, shares) {
    return fetch(`${API_BASE}/api/pools/${poolId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shares })
    }).then(r => {
      if (!r.ok) return r.json().then(e => { throw new Error(e.error); });
      return r.json();
    });
  },

  // Results
  async getLatestResult() {
    return fetch(`${API_BASE}/api/results/latest`).then(r => r.json());
  },
  async getResultByContest(contest) {
    return fetch(`${API_BASE}/api/results/${contest}`).then(r => r.json());
  },

  // AI
  async getAISeed() {
    return fetch(`${API_BASE}/api/ai/seed`).then(r => r.json());
  },
  async generateAIGames(gameType, quantity = 5) {
    return fetch(`${API_BASE}/api/ai/generate?gameType=${gameType}&quantity=${quantity}`).then(r => r.json());
  },
  async simulate(numbers) {
    return fetch(`${API_BASE}/api/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numbers })
    }).then(r => r.json());
  },

  // ==================== GAMES PORTFOLIO ====================
  async saveGame(numbers, options = {}) {
    return fetch(`${API_BASE}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numbers, ...options })
    }).then(r => r.json());
  },
  async getGames(status = '', source = '', gameType = '') {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (source) params.set('source', source);
    if (gameType) params.set('gameType', gameType);
    return fetch(`${API_BASE}/api/games?${params}`).then(r => r.json());
  },
  async getGameStats() {
    return fetch(`${API_BASE}/api/games/stats`).then(r => r.json());
  },
  async updateGame(id, data) {
    return fetch(`${API_BASE}/api/games/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json());
  },
  async deleteGame(id) {
    return fetch(`${API_BASE}/api/games/${id}`, { method: 'DELETE' }).then(r => r.json());
  },
  async useGame(id, contestNumber) {
    return fetch(`${API_BASE}/api/games/${id}/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contestNumber })
    }).then(r => r.json());
  },
  async checkGameResult(id) {
    return fetch(`${API_BASE}/api/games/${id}/check-result`, {
      method: 'POST'
    }).then(r => r.json());
  },
  async createPoolFromGame(id, poolData) {
    return fetch(`${API_BASE}/api/games/${id}/create-pool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(poolData)
    }).then(r => r.json());
  },
  async duplicateGame(id) {
    return fetch(`${API_BASE}/api/games/${id}/duplicate`, {
      method: 'POST'
    }).then(r => r.json());
  },

  // ==================== NOTIFICAÇÕES ====================
  async getNotifications() {
    return fetch(`${API_BASE}/api/notifications`).then(r => r.json());
  },
  async readNotification(id) {
    return fetch(`${API_BASE}/api/notifications/${id}/read`, { method: 'POST' }).then(r => r.json());
  },
  async readAllNotifications() {
    return fetch(`${API_BASE}/api/notifications/read-all`, { method: 'POST' }).then(r => r.json());
  },

  // ==================== DASHBOARD TURBINADA ====================
  async getLuckyNumbers() {
    return fetch(`${API_BASE}/api/dashboard/lucky-numbers`).then(r => r.json());
  },
  async getPortfolioInsights() {
    return fetch(`${API_BASE}/api/dashboard/portfolio-insights`).then(r => r.json());
  },

  // ==================== EXPORTAÇÃO ====================
  async exportGamesCSV() {
    window.open(`${API_BASE}/api/games/export-csv`, '_blank');
  },
  async getPerformanceReport() {
    return fetch(`${API_BASE}/api/games/performance-report`).then(r => r.json());
  },

  // ==================== MERCADO DE COTAS ====================
  async createOffer(poolId, shares, price) {
    return fetch(`${API_BASE}/api/pools/${poolId}/create-offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shares, price })
    }).then(r => r.json());
  },
  async buyOffer(poolId, offerId) {
    return fetch(`${API_BASE}/api/pools/${poolId}/buy-offer/${offerId}`, {
      method: 'POST'
    }).then(r => r.json());
  },

  // ==================== ASSINATURAS ====================
  async createSubscription(data) {
    return fetch(`${API_BASE}/api/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json());
  },
  async getSubscriptions() {
    return fetch(`${API_BASE}/api/subscriptions`).then(r => r.json());
  },
  async deleteSubscription(id) {
    return fetch(`${API_BASE}/api/subscriptions/${id}`, { method: 'DELETE' }).then(r => r.json());
  },

  // Game Comparison
  async compareGames(gameIds) {
    return fetch(`${API_BASE}/api/games/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameIds })
    }).then(r => r.json());
  },

  // Advanced Stats
  async getAdvancedStats(limit = 100) {
    return fetch(`${API_BASE}/api/stats/advanced?limit=${limit}`).then(r => r.json());
  },

  // Profile
  async updateProfile(name, email) {
    return fetch(`${API_BASE}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    }).then(r => r.json());
  },

  // ==================== GAMIFICAÇÃO ====================
  async getLevel() {
    return fetch(`${API_BASE}/api/gamification/level`).then(r => r.json());
  },
  async getAchievements() {
    return fetch(`${API_BASE}/api/gamification/achievements`).then(r => r.json());
  },

  // ==================== CONFIG DE LOTERIAS ====================
  async getLotteryConfig() {
    return fetch(`${API_BASE}/api/lottery-config`).then(r => r.json());
  },
  async getAdminLotteryConfig() {
    return fetch(`${API_BASE}/api/admin/lottery-config`).then(r => r.json());
  },
  async saveAdminLotteryConfig(gameType, prices) {
    return fetch(`${API_BASE}/api/admin/lottery-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameType, prices })
    }).then(r => r.json());
  },
  async deleteAdminLotteryConfig(gameType) {
    return fetch(`${API_BASE}/api/admin/lottery-config/${gameType}`, { method: 'DELETE' }).then(r => r.json());
  },

  // ==================== COMPARTILHAMENTO ====================
  async shareGame(gameId, platform) {
    return fetch(`${API_BASE}/api/share/game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, platform })
    }).then(r => r.json());
  },
  async sharePool(poolId, platform) {
    return fetch(`${API_BASE}/api/share/pool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poolId, platform })
    }).then(r => r.json());
  },
  async getShareStats() {
    return fetch(`${API_BASE}/api/games/share-stats`).then(r => r.json());
  },
  async getPopularPools() {
    return fetch(`${API_BASE}/api/pools/popular`).then(r => r.json());
  }
};
