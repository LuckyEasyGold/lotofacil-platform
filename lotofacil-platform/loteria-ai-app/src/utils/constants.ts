// AsyncStorage keys
export const STORAGE_KEYS = {
  USER_DATA: '@loteria:user_data',
  GAMES_HISTORY: '@loteria:games_history',
  TRANSACTIONS: '@loteria:transactions',
  SAVED_GAMES: '@loteria:saved_games',
  SETTINGS: '@loteria:settings',
  BOLAOES: '@loteria:bolaes'
};

// Game types configuration
export const GAME_CONFIGS = {
  lotofacil: {
    name: 'Lotofácil',
    minNumber: 1,
    maxNumber: 25,
    numbersToPick: 15,
    maxNumbersOnBet: 20,
    color: '#9333ea',
    icon: 'flower'
  },
  megasena: {
    name: 'Mega Sena',
    minNumber: 1,
    maxNumber: 60,
    numbersToPick: 6,
    maxNumbersOnBet: 20,
    color: '#22c55e',
    icon: 'clover'
  },
  quina: {
    name: 'Quina',
    minNumber: 1,
    maxNumber: 80,
    numbersToPick: 5,
    maxNumbersOnBet: 15,
    color: '#3b82f6',
    icon: 'star'
  },
  lotomania: {
    name: 'Lotomania',
    minNumber: 0,
    maxNumber: 99,
    numbersToPick: 50,
    maxNumbersOnBet: 60,
    color: '#f97316',
    icon: 'ticket'
  },
  duplasena: {
    name: 'Dupla Sena',
    minNumber: 1,
    maxNumber: 50,
    numbersToPick: 6,
    maxNumbersOnBet: 15,
    color: '#ef4444',
    icon: 'tickets'
  },
  timemania: {
    name: 'Timemania',
    minNumber: 1,
    maxNumber: 80,
    numbersToPick: 10,
    maxNumbersOnBet: 10,
    color: '#84cc16',
    icon: 'trophy'
  },
  diadesorte: {
    name: 'Dia de Sorte',
    minNumber: 1,
    maxNumber: 31,
    numbersToPick: 7,
    maxNumbersOnBet: 12,
    color: '#06b6d4',
    icon: 'calendar'
  },
  supersete: {
    name: 'Super Sete',
    minNumber: 0,
    maxNumber: 9,
    numbersToPick: 7,
    maxNumbersOnBet: 7,
    color: '#ec4899',
    icon: 'grid'
  },
  federal: {
    name: 'Federal',
    minNumber: 0,
    maxNumber: 99999,
    numbersToPick: 5,
    maxNumbersOnBet: 5,
    color: '#f59e0b',
    icon: 'document'
  }
};

// Transaction types
export const TRANSACTION_TYPES = {
  DEPOSIT: {
    type: 'deposit',
    label: 'Depósito',
    icon: 'arrow-down',
    color: '#22c55e'
  },
  WITHDRAWAL: {
    type: 'withdrawal',
    label: 'Saque',
    icon: 'arrow-up',
    color: '#ef4444'
  },
  BET: {
    type: 'bet',
    label: 'Aposta',
    icon: 'ticket',
    color: '#3b82f6'
  },
  PRIZE: {
    type: 'prize',
    label: 'Prêmio',
    icon: 'trophy',
    color: '#fbbf24'
  },
  BOLETA_PURCHASE: {
    type: 'boleta_purchase',
    label: 'Compra de Cota',
    icon: 'cart',
    color: '#8b5cf6'
  },
  BOLETA_SALE: {
    type: 'boleta_sale',
    label: 'Venda de Cota',
    icon: 'hand',
    color: '#06b6d4'
  },
  TRANSFER_IN: {
    type: 'transfer_in',
    label: 'Transferência Recebida',
    icon: 'arrow-down-circle',
    color: '#10b981'
  },
  TRANSFER_OUT: {
    type: 'transfer_out',
    label: 'Transferência Enviada',
    icon: 'arrow-up-circle',
    color: '#f43f5e'
  }
};

// Default user data
export const DEFAULT_USER = {
  id: 'user_001',
  name: 'Usuário',
  email: 'usuario@email.com',
  phone: '',
  document: '',
  balance: 0,
  createdAt: new Date().toISOString()
};

// App settings defaults
export const DEFAULT_SETTINGS = {
  notifications: true,
  biometrics: false,
  darkMode: false,
  currency: 'BRL',
  language: 'pt-BR'
};

// Mock last results (for demo purposes)
export const LAST_RESULTS = {
  lotofacil: {
    contest: 3045,
    date: '2024-01-15',
    numbers: [1, 2, 3, 4, 5, 7, 9, 10, 11, 13, 15, 18, 20, 22, 25]
  },
  megasena: {
    contest: 2678,
    date: '2024-01-13',
    numbers: [5, 12, 23, 34, 45, 56]
  },
  quina: {
    contest: 6234,
    date: '2024-01-14',
    numbers: [8, 15, 27, 43, 67]
  },
  lotomania: {
    contest: 2567,
    date: '2024-01-15',
    numbers: Array.from({length: 50}, (_, i) => i * 2)
  }
};

// Navigation routes
export const ROUTES = {
  HOME: 'Home',
  WALLET: 'Carteira',
  HISTORY: 'Histórico',
  PROFILE: 'Perfil',
  GAME_DETAIL: 'GameDetail',
  SIMULATOR: 'Simulator',
  BOLETA_DETAIL: 'BoletaDetail',
  SETTINGS: 'Settings'
};
