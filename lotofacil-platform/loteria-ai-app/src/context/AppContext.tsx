import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Transaction, LotteryResult, GeneratedBet, GameType, BetSimulation, Shareholding, UserProfile } from '../types';
import { apiService } from '../services/api';

interface AppContextType {
  user: User | null;
  userProfile: UserProfile | null;
  balance: number;
  transactions: Transaction[];
  lastResults: LotteryResult[];
  generatedBets: GeneratedBet[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  generateBet: (gameType: GameType, quantity?: number) => Promise<void>;
  simulateBet: (gameType: GameType, numbers: number[], contestsBack?: number) => Promise<BetSimulation>;
  availableShareholdings: Shareholding[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lastResults, setLastResults] = useState<LotteryResult[]>([]);
  const [generatedBets, setGeneratedBets] = useState<GeneratedBet[]>([]);
  const [availableShareholdings, setAvailableShareholdings] = useState<Shareholding[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserData = async () => {
    try {
      const profile = await apiService.getUserProfile();
      setUser(profile.user);
      setUserProfile(profile);
      setBalance(profile.user.balance);
      
      const txs = await apiService.getTransactions(20);
      setTransactions(txs);
      
      const results = await apiService.getAllLastResults();
      setLastResults(results);
      
      const shareholdings = await apiService.getAvailableShareholdings();
      setAvailableShareholdings(shareholdings);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  const refreshData = async () => {
    setIsLoading(true);
    await loadUserData();
  };

  const generateBet = async (gameType: GameType, quantity: number = 1) => {
    try {
      const bets = await apiService.generateBetWithAI(gameType, quantity);
      setGeneratedBets(prev => [...bets, ...prev]);
    } catch (error) {
      console.error('Error generating bet:', error);
    }
  };

  const simulateBet = async (
    gameType: GameType, 
    numbers: number[], 
    contestsBack: number = 50
  ): Promise<BetSimulation> => {
    return await apiService.simulateBet(gameType, numbers, contestsBack);
  };

  const value: AppContextType = {
    user,
    userProfile,
    balance,
    transactions,
    lastResults,
    generatedBets,
    isLoading,
    refreshData,
    generateBet,
    simulateBet,
    availableShareholdings,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
