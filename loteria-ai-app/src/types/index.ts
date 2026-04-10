// Types for the Lottery AI App

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  balance: number;
  createdAt: Date;
}

export interface BankAccount {
  id: string;
  bankName: string;
  agency: string;
  accountNumber: string;
  accountType: 'checking' | 'savings';
  holderName: string;
  holderDocument: string;
  isVerified: boolean;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: Date;
  status: 'pending' | 'completed' | 'cancelled';
}

export type TransactionType = 
  | 'deposit'
  | 'withdrawal'
  | 'prize'
  | 'bet_payment'
  | 'share_sale'
  | 'share_purchase';

export interface LotteryResult {
  id: string;
  gameType: GameType;
  contestNumber: number;
  drawDate: Date;
  numbers: number[];
  specialNumbers?: number[]; // For games like Quina, Lotofácil
  prizeAmount: number;
  winners: number;
}

export type GameType = 
  | 'lotofacil'
  | 'megasena'
  | 'quina'
  | 'lotomania'
  | 'timemania'
  | 'duplasena'
  | 'dia_de_sorte'
  | 'super_sete'
  | '+milionaria';

export interface GeneratedBet {
  id: string;
  gameType: GameType;
  numbers: number[];
  specialNumbers?: number[];
  generatedAt: Date;
  aiAnalysis?: AIAnalysis;
  usedInContests?: UsedBet[];
}

export interface UsedBet {
  contestNumber: number;
  usedAt: Date;
  result?: LotteryResult;
  hits?: number;
  prize?: number;
}

export interface AIAnalysis {
  confidence: number;
  basedOnResults: number;
  strategy: string;
  hotNumbers: number[];
  coldNumbers: number[];
  recommendations: string[];
}

export interface BetSimulation {
  id: string;
  gameType: GameType;
  numbers: number[];
  specialNumbers?: number[];
  simulationPeriod: {
    start: Date;
    end: Date;
  };
  results: SimulationResult[];
  totalHits: number;
  bestHit: number;
  totalPrize: number;
}

export interface SimulationResult {
  contestNumber: number;
  drawDate: Date;
  drawnNumbers: number[];
  hits: number;
  prize?: number;
}

export interface Shareholding {
  id: string;
  gameType: GameType;
  contestNumber: number;
  totalShares: number;
  availableShares: number;
  sharePrice: number;
  creatorId: string;
  numbers: number[];
  specialNumbers?: number[];
  status: 'open' | 'closed' | 'completed';
}

export interface UserProfile {
  user: User;
  bankAccount?: BankAccount;
  totalDeposits: number;
  totalWithdrawals: number;
  totalPrizes: number;
  totalSpentOnBets: number;
  totalEarnedFromShares: number;
  totalSpentOnShares: number;
}
