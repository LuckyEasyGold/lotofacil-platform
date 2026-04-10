import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { GameCard } from '../components/GameCard';
import { TransactionItem } from '../components/TransactionItem';

const games = [
  { type: 'lotofacil' as const, name: 'Lotofácil', color: '#93328E', icon: 'flower-outline' },
  { type: 'megasena' as const, name: 'Mega Sena', color: '#209869', icon: 'leaf-outline' },
  { type: 'quina' as const, name: 'Quina', color: '#2648A3', icon: 'diamond-outline' },
  { type: 'lotomania' as const, name: 'Lotomania', color: '#F78102', icon: 'grid-outline' },
  { type: 'timemania' as const, name: 'Time Mania', color: '#00B5B2', icon: 'shirt-outline' },
  { type: 'duplasena' as const, name: 'Dupla Sena', color: '#C7232E', icon: 'repeat-outline' },
  { type: 'dia_de_sorte' as const, name: 'Dia de Sorte', color: '#8A2E8A', icon: 'cloudy-outline' },
  { type: 'super_sete' as const, name: 'Super Sete', color: '#009FE3', icon: 'key-outline' },
  { type: '+milionaria' as const, name: '+Milionária', color: '#003366', icon: 'star-outline' },
];

export const HomeScreen: React.FC = () => {
  const { balance, lastResults, transactions, isLoading, generateBet } = useApp();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateBet = async (gameType: typeof games[0]['type']) => {
    setIsGenerating(true);
    try {
      await generateBet(gameType, 1);
      alert('Jogo gerado com sucesso! Verifique no histórico.');
    } catch (error) {
      alert('Erro ao gerar jogo. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getResultForGame = (gameType: string) => {
    const result = lastResults.find(r => r.gameType === gameType);
    return result?.numbers;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header with Balance */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, Usuário</Text>
          <Text style={styles.subtitle}>Saldo disponível</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Saldo Atual</Text>
        <Text style={styles.balanceValue}>
          R$ {balance.toFixed(2)}
        </Text>
        <View style={styles.balanceActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="add-circle" size={24} color="#10B981" />
            <Text style={styles.actionButtonText}>Depositar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="remove-circle" size={24} color="#EF4444" />
            <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Sacar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Last Results Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Últimos Resultados</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>Ver todos</Text>
          </TouchableOpacity>
        </View>
        
        {lastResults.slice(0, 3).map((result) => (
          <View key={result.id} style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultGameName}>
                {result.gameType.charAt(0).toUpperCase() + result.gameType.slice(1)}
              </Text>
              <Text style={styles.resultContest}>Concurso {result.contestNumber}</Text>
            </View>
            <View style={styles.resultNumbers}>
              {result.numbers.map((num, index) => (
                <View key={index} style={styles.resultBall}>
                  <Text style={styles.resultBallText}>{num}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.resultDate}>
              {result.drawDate.toLocaleDateString('pt-BR')}
            </Text>
          </View>
        ))}
      </View>

      {/* Games Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gerar Jogos com IA</Text>
        <Text style={styles.sectionDescription}>
          Escolha um jogo e nossa IA analisará os resultados para gerar suas melhores apostas
        </Text>

        {games.map((game) => (
          <GameCard
            key={game.type}
            gameType={game.type}
            name={game.name}
            color={game.color}
            icon={game.icon}
            lastResult={getResultForGame(game.type)}
            onPress={() => handleGenerateBet(game.type)}
          />
        ))}
      </View>

      {/* Recent Transactions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transações Recentes</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>Ver extrato</Text>
          </TouchableOpacity>
        </View>

        {transactions.slice(0, 5).map((transaction) => (
          <TransactionItem key={transaction.id} transaction={transaction} />
        ))}
      </View>

      {isGenerating && (
        <View style={styles.generatingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.generatingText}>IA gerando seu jogo...</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceCard: {
    backgroundColor: '#10B981',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginVertical: 8,
  },
  balanceActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  section: {
    marginTop: 8,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  resultGameName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  resultContest: {
    fontSize: 14,
    color: '#666',
  },
  resultNumbers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  resultBall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    marginBottom: 6,
  },
  resultBallText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  resultDate: {
    fontSize: 12,
    color: '#999',
  },
  generatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  generatingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
  },
});
