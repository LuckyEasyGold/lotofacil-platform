import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { GameType } from '../types';

const games = [
  { type: 'lotofacil' as const, name: 'Lotofácil', color: '#93328E', icon: 'flower-outline' },
  { type: 'megasena' as const, name: 'Mega Sena', color: '#209869', icon: 'leaf-outline' },
  { type: 'quina' as const, name: 'Quina', color: '#2648A3', icon: 'diamond-outline' },
  { type: 'lotomania' as const, name: 'Lotomania', color: '#F78102', icon: 'grid-outline' },
];

export const HistoryScreen: React.FC = () => {
  const { generatedBets, simulateBet, isLoading } = useApp();
  const [selectedBet, setSelectedBet] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

  const handleSimulate = async (bet: any) => {
    setIsSimulating(true);
    try {
      const result = await simulateBet(bet.gameType, bet.numbers, 50);
      setSimulationResult(result);
      setSelectedBet(bet.id);
    } catch (error) {
      alert('Erro ao simular. Tente novamente.');
    } finally {
      setIsSimulating(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading && generatedBets.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Histórico de Jogos</Text>
        <Text style={styles.subtitle}>
          Veja seus jogos gerados e simule resultados
        </Text>
      </View>

      {/* Generated Bets List */}
      <View style={styles.section}>
        {generatedBets.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="ticket-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum jogo gerado ainda</Text>
            <Text style={styles.emptySubtext}>
              Vá para a tela inicial e gere seu primeiro jogo com IA
            </Text>
          </View>
        ) : (
          generatedBets.map((bet) => (
            <View key={bet.id} style={styles.betCard}>
              <View style={styles.betHeader}>
                <View style={styles.gameInfo}>
                  <View style={[styles.gameIcon, { backgroundColor: '#93328E20' }]}>
                    <Ionicons name="flower" size={20} color="#93328E" />
                  </View>
                  <View>
                    <Text style={styles.gameName}>
                      {bet.gameType.charAt(0).toUpperCase() + bet.gameType.slice(1)}
                    </Text>
                    <Text style={styles.generatedDate}>
                      Gerado em {bet.generatedAt.toLocaleDateString('pt-BR')} às{' '}
                      {bet.generatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.numbersContainer}>
                <Text style={styles.numbersLabel}>Números:</Text>
                <View style={styles.numbersRow}>
                  {bet.numbers.map((num, index) => (
                    <View key={index} style={styles.numberBall}>
                      <Text style={styles.numberText}>{num}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {bet.aiAnalysis && (
                <View style={styles.aiAnalysis}>
                  <View style={styles.aiHeader}>
                    <Ionicons name="sparkles" size={16} color="#93328E" />
                    <Text style={styles.aiTitle}>Análise da IA</Text>
                  </View>
                  <View style={styles.aiStats}>
                    <View style={styles.aiStat}>
                      <Text style={styles.aiStatLabel}>Confiança</Text>
                      <Text style={styles.aiStatValue}>
                        {bet.aiAnalysis.confidence.toFixed(0)}%
                      </Text>
                    </View>
                    <View style={styles.aiStat}>
                      <Text style={styles.aiStatLabel}>Base</Text>
                      <Text style={styles.aiStatValue}>
                        {bet.aiAnalysis.basedOnResults} concursos
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.aiStrategy}>{bet.aiAnalysis.strategy}</Text>
                </View>
              )}

              <TouchableOpacity 
                style={styles.simulateButton}
                onPress={() => handleSimulate(bet)}
                disabled={isSimulating}
              >
                <Ionicons name="analytics" size={20} color="#fff" />
                <Text style={styles.simulateButtonText}>
                  {isSimulating ? 'Simulando...' : 'Simular Resultados'}
                </Text>
              </TouchableOpacity>

              {selectedBet === bet.id && simulationResult && (
                <View style={styles.simulationResult}>
                  <View style={styles.resultHeader}>
                    <Text style={styles.resultTitle}>Resultado da Simulação</Text>
                    <TouchableOpacity onPress={() => setSimulationResult(null)}>
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.resultStats}>
                    <View style={styles.resultStatCard}>
                      <Text style={styles.resultStatLabel}>Melhor Acerto</Text>
                      <Text style={styles.resultStatValue}>{simulationResult.bestHit} números</Text>
                    </View>
                    <View style={styles.resultStatCard}>
                      <Text style={styles.resultStatLabel}>Acertos ≥ 11</Text>
                      <Text style={styles.resultStatValue}>{simulationResult.totalHits}</Text>
                    </View>
                    <View style={styles.resultStatCard}>
                      <Text style={styles.resultStatLabel}>Prêmio Total</Text>
                      <Text style={[styles.resultStatValue, { color: '#10B981' }]}>
                        {formatCurrency(simulationResult.totalPrize)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.periodInfo}>
                    <Ionicons name="calendar" size={16} color="#666" />
                    <Text style={styles.periodText}>
                      Período: {simulationResult.simulationPeriod.start.toLocaleDateString('pt-BR')} até{' '}
                      {simulationResult.simulationPeriod.end.toLocaleDateString('pt-BR')}
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.closeButton} onPress={() => setSimulationResult(null)}>
                    <Text style={styles.closeButtonText}>Fechar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {isSimulating && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.overlayText}>Simulando em 50 últimos concursos...</Text>
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
    padding: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
    textAlign: 'center',
  },
  betCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  betHeader: {
    marginBottom: 16,
  },
  gameInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gameIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  gameName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  generatedDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  numbersContainer: {
    marginBottom: 16,
  },
  numbersLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  numbersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  numberBall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#93328E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  numberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  aiAnalysis: {
    backgroundColor: '#93328E08',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#93328E',
  },
  aiStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  aiStat: {
    flexDirection: 'column',
  },
  aiStatLabel: {
    fontSize: 11,
    color: '#666',
  },
  aiStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#93328E',
  },
  aiStrategy: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  simulateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#93328E',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  simulateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  simulationResult: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  resultStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  resultStatCard: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  resultStatLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  resultStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  periodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  periodText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  closeButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
  },
});
