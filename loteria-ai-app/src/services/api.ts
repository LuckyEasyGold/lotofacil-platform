// Mock API Service for Lottery AI App
import { 
  User, 
  LotteryResult, 
  GeneratedBet, 
  Transaction, 
  GameType,
  AIAnalysis,
  BetSimulation,
  Shareholding,
  UserProfile 
} from '../types';

// Mock data
const mockUser: User = {
  id: '1',
  name: 'João Silva',
  email: 'joao.silva@email.com',
  phone: '(11) 99999-9999',
  balance: 1500.00,
  createdAt: new Date('2024-01-15'),
};

const mockTransactions: Transaction[] = [
  {
    id: '1',
    type: 'deposit',
    amount: 500.00,
    description: 'Depósito via PIX',
    date: new Date('2024-12-01'),
    status: 'completed',
  },
  {
    id: '2',
    type: 'bet_payment',
    amount: -50.00,
    description: 'Aposta Lotofácil - Concurso 3000',
    date: new Date('2024-12-02'),
    status: 'completed',
  },
  {
    id: '3',
    type: 'prize',
    amount: 1200.00,
    description: 'Prêmio Lotofácil - 14 pontos',
    date: new Date('2024-12-03'),
    status: 'completed',
  },
  {
    id: '4',
    type: 'share_sale',
    amount: 150.00,
    description: 'Venda de 3 cotas - Bolão Mega Sena',
    date: new Date('2024-12-04'),
    status: 'completed',
  },
  {
    id: '5',
    type: 'withdrawal',
    amount: -800.00,
    description: 'Saque para conta bancária',
    date: new Date('2024-12-05'),
    status: 'pending',
  },
];

const mockLotteryResults: LotteryResult[] = [
  {
    id: '1',
    gameType: 'lotofacil',
    contestNumber: 3001,
    drawDate: new Date('2024-12-06'),
    numbers: [1, 2, 3, 5, 7, 9, 10, 11, 13, 14, 15, 17, 19, 20, 25],
    prizeAmount: 1500000.00,
    winners: 0,
  },
  {
    id: '2',
    gameType: 'megasena',
    contestNumber: 2700,
    drawDate: new Date('2024-12-05'),
    numbers: [5, 12, 23, 34, 45, 56],
    prizeAmount: 50000000.00,
    winners: 1,
  },
  {
    id: '3',
    gameType: 'quina',
    contestNumber: 6500,
    drawDate: new Date('2024-12-04'),
    numbers: [8, 15, 28, 42, 67],
    prizeAmount: 800000.00,
    winners: 2,
  },
];

// API Service
export const apiService = {
  // User operations
  async getUserProfile(): Promise<UserProfile> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          user: mockUser,
          totalDeposits: 5000.00,
          totalWithdrawals: 2000.00,
          totalPrizes: 3500.00,
          totalSpentOnBets: 1200.00,
          totalEarnedFromShares: 450.00,
          totalSpentOnShares: 300.00,
        });
      }, 500);
    });
  },

  async getTransactions(limit: number = 20): Promise<Transaction[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockTransactions.slice(0, limit));
      }, 300);
    });
  },

  // Lottery results
  async getLastResult(gameType: GameType): Promise<LotteryResult | null> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = mockLotteryResults.find(r => r.gameType === gameType);
        resolve(result || null);
      }, 300);
    });
  },

  async getAllLastResults(): Promise<LotteryResult[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockLotteryResults);
      }, 400);
    });
  },

  async getHistoricalResults(
    gameType: GameType, 
    limit: number = 50
  ): Promise<LotteryResult[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Generate mock historical results
        const results: LotteryResult[] = [];
        for (let i = 0; i < limit; i++) {
          results.push({
            id: `${gameType}-${i}`,
            gameType,
            contestNumber: 3001 - i,
            drawDate: new Date(Date.now() - i * 86400000),
            numbers: this.generateRandomNumbers(gameType),
            prizeAmount: Math.random() * 2000000,
            winners: Math.floor(Math.random() * 5),
          });
        }
        resolve(results);
      }, 500);
    });
  },

  // AI Generation
  async generateBetWithAI(
    gameType: GameType,
    quantity: number = 1
  ): Promise<GeneratedBet[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const bets: GeneratedBet[] = [];
        for (let i = 0; i < quantity; i++) {
          const numbers = this.generateRandomNumbers(gameType);
          bets.push({
            id: `bet-${Date.now()}-${i}`,
            gameType,
            numbers,
            generatedAt: new Date(),
            aiAnalysis: {
              confidence: 75 + Math.random() * 20,
              basedOnResults: 100,
              strategy: 'Análise de frequência e atraso',
              hotNumbers: numbers.slice(0, 5),
              coldNumbers: numbers.slice(5, 8),
              recommendations: [
                'Números quentes dos últimos 10 concursos',
                'Equilíbrio entre pares e ímpares',
                'Distribuição uniforme no volante',
              ],
            },
          });
        }
        resolve(bets);
      }, 1000);
    });
  },

  // Simulation
  async simulateBet(
    gameType: GameType,
    numbers: number[],
    contestsBack: number = 50
  ): Promise<BetSimulation> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const results: any[] = [];
        let totalHits = 0;
        let bestHit = 0;
        let totalPrize = 0;

        for (let i = 0; i < contestsBack; i++) {
          const drawnNumbers = this.generateRandomNumbers(gameType);
          const hits = numbers.filter(n => drawnNumbers.includes(n)).length;
          const prize = hits >= 11 ? Math.random() * 1000 : 0;
          
          if (hits > bestHit) bestHit = hits;
          if (hits >= 11) totalHits++;
          totalPrize += prize;

          results.push({
            contestNumber: 3001 - i,
            drawDate: new Date(Date.now() - i * 86400000),
            drawnNumbers,
            hits,
            prize: prize > 0 ? prize : undefined,
          });
        }

        resolve({
          id: `sim-${Date.now()}`,
          gameType,
          numbers,
          simulationPeriod: {
            start: new Date(Date.now() - contestsBack * 86400000),
            end: new Date(),
          },
          results,
          totalHits,
          bestHit,
          totalPrize,
        });
      }, 1500);
    });
  },

  // Shareholding
  async getAvailableShareholdings(): Promise<Shareholding[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: '1',
            gameType: 'megasena',
            contestNumber: 2701,
            totalShares: 100,
            availableShares: 45,
            sharePrice: 50.00,
            creatorId: 'user-2',
            numbers: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
            status: 'open',
          },
          {
            id: '2',
            gameType: 'lotofacil',
            contestNumber: 3002,
            totalShares: 50,
            availableShares: 20,
            sharePrice: 25.00,
            creatorId: 'user-3',
            numbers: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20],
            status: 'open',
          },
        ]);
      }, 400);
    });
  },

  // Helper methods
  generateRandomNumbers(gameType: GameType): number[] {
    const configs: Record<GameType, { total: number; pick: number }> = {
      lotofacil: { total: 25, pick: 15 },
      megasena: { total: 60, pick: 6 },
      quina: { total: 80, pick: 5 },
      lotomania: { total: 100, pick: 50 },
      timemania: { total: 80, pick: 7 },
      duplasena: { total: 50, pick: 6 },
      dia_de_sorte: { total: 31, pick: 7 },
      super_sete: { total: 10, pick: 7 },
      '+milionaria': { total: 50, pick: 6 },
    };

    const config = configs[gameType] || configs.lotofacil;
    const numbers = new Set<number>();
    
    while (numbers.size < config.pick) {
      numbers.add(Math.floor(Math.random() * config.total) + 1);
    }

    return Array.from(numbers).sort((a, b) => a - b);
  },
};
