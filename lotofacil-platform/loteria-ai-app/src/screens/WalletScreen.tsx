import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { TransactionItem } from '../components/TransactionItem';

export const WalletScreen: React.FC = () => {
  const { balance, transactions, userProfile, isLoading, refreshData } = useApp();
  const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'withdrawals' | 'bets' | 'shares'>('all');

  const filterTransactions = () => {
    if (activeTab === 'all') return transactions;
    
    const typeMap = {
      deposits: ['deposit', 'prize', 'share_sale'],
      withdrawals: ['withdrawal', 'bet_payment', 'share_purchase'],
      bets: ['bet_payment'],
      shares: ['share_sale', 'share_purchase'],
    };
    
    return transactions.filter(t => typeMap[activeTab]?.includes(t.type));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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
      {/* Balance Card */}
      <View style={styles.balanceSection}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo Disponível</Text>
          <Text style={styles.balanceValue}>{formatCurrency(balance)}</Text>
          
          <View style={styles.balanceActions}>
            <TouchableOpacity style={styles.actionButtonPrimary}>
              <Ionicons name="add-circle-outline" size={24} color="#fff" />
              <Text style={styles.actionButtonTextPrimary}>Depositar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButtonSecondary}>
              <Ionicons name="remove-circle-outline" size={24} color="#10B981" />
              <Text style={styles.actionButtonTextSecondary}>Sacar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Financial Summary */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="arrow-down-circle" size={24} color="#10B981" />
            </View>
            <Text style={styles.summaryLabel}>Total Depositado</Text>
            <Text style={[styles.summaryValue, { color: '#10B981' }]}>
              {formatCurrency(userProfile?.totalDeposits || 0)}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: '#EF444420' }]}>
              <Ionicons name="arrow-up-circle" size={24} color="#EF4444" />
            </View>
            <Text style={styles.summaryLabel}>Total Sacado</Text>
            <Text style={[styles.summaryValue, { color: '#EF4444' }]}>
              {formatCurrency(userProfile?.totalWithdrawals || 0)}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="trophy" size={24} color="#F59E0B" />
            </View>
            <Text style={styles.summaryLabel}>Prêmios Ganhos</Text>
            <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
              {formatCurrency(userProfile?.totalPrizes || 0)}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: '#6B728020' }]}>
              <Ionicons name="ticket" size={24} color="#6B7280" />
            </View>
            <Text style={styles.summaryLabel}>Gasto em Apostas</Text>
            <Text style={[styles.summaryValue, { color: '#6B7280' }]}>
              {formatCurrency(userProfile?.totalSpentOnBets || 0)}
            </Text>
          </View>
        </View>

        {/* Shares Summary */}
        <View style={styles.sharesSummary}>
          <View style={styles.shareRow}>
            <View style={styles.shareInfo}>
              <Ionicons name="people" size={20} color="#10B981" />
              <Text style={styles.shareLabel}>Venda de Cotas</Text>
            </View>
            <Text style={[styles.shareValue, { color: '#10B981' }]}>
              +{formatCurrency(userProfile?.totalEarnedFromShares || 0)}
            </Text>
          </View>

          <View style={styles.shareRow}>
            <View style={styles.shareInfo}>
              <Ionicons name="cart" size={20} color="#EF4444" />
              <Text style={styles.shareLabel}>Compra de Cotas</Text>
            </View>
            <Text style={[styles.shareValue, { color: '#EF4444' }]}>
              -{formatCurrency(userProfile?.totalSpentOnShares || 0)}
            </Text>
          </View>
        </View>
      </View>

      {/* Bank Account Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Conta Bancária</Text>
          <TouchableOpacity>
            <Text style={styles.editText}>Editar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bankCard}>
          <View style={styles.bankHeader}>
            <Ionicons name="bank" size={32} color="#10B981" />
            <View style={styles.bankInfo}>
              <Text style={styles.bankName}>Banco não cadastrado</Text>
              <Text style={styles.bankStatus}>Adicione uma conta para saques</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.addBankButton}>
            <Ionicons name="add-circle" size={20} color="#10B981" />
            <Text style={styles.addBankText}>Cadastrar Conta Bancária</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Transactions Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Extrato</Text>
          <TouchableOpacity onPress={refreshData}>
            <Ionicons name="refresh" size={20} color="#10B981" />
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'all' && styles.activeTab]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
              Todos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'deposits' && styles.activeTab]}
            onPress={() => setActiveTab('deposits')}
          >
            <Text style={[styles.tabText, activeTab === 'deposits' && styles.activeTabText]}>
              Entradas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'withdrawals' && styles.activeTab]}
            onPress={() => setActiveTab('withdrawals')}
          >
            <Text style={[styles.tabText, activeTab === 'withdrawals' && styles.activeTabText]}>
              Saídas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'bets' && styles.activeTab]}
            onPress={() => setActiveTab('bets')}
          >
            <Text style={[styles.tabText, activeTab === 'bets' && styles.activeTabText]}>
              Apostas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'shares' && styles.activeTab]}
            onPress={() => setActiveTab('shares')}
          >
            <Text style={[styles.tabText, activeTab === 'shares' && styles.activeTabText]}>
              Cotas
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Transaction List */}
        <View style={styles.transactionList}>
          {filterTransactions().map((transaction) => (
            <TransactionItem key={transaction.id} transaction={transaction} />
          ))}
        </View>
      </View>
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
  balanceSection: {
    padding: 16,
  },
  balanceCard: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
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
    marginBottom: 20,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonTextPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10B981',
  },
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonTextSecondary: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  sharesSummary: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  shareInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareLabel: {
    fontSize: 14,
    color: '#666',
  },
  shareValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  editText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  bankCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  bankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bankInfo: {
    marginLeft: 12,
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  bankStatus: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  addBankButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B98115',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addBankText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  tabsContainer: {
    marginBottom: 12,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeTab: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  tabText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  transactionList: {
    paddingBottom: 20,
  },
});
