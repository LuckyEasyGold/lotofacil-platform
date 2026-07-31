import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction } from '../types';

interface TransactionItemProps {
  transaction: Transaction;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ transaction }) => {
  const getTransactionIcon = () => {
    switch (transaction.type) {
      case 'deposit':
        return { name: 'arrow-down-circle', color: '#10B981' };
      case 'withdrawal':
        return { name: 'arrow-up-circle', color: '#EF4444' };
      case 'prize':
        return { name: 'trophy', color: '#F59E0B' };
      case 'bet_payment':
        return { name: 'ticket', color: '#6B7280' };
      case 'share_sale':
        return { name: 'people', color: '#10B981' };
      case 'share_purchase':
        return { name: 'cart', color: '#EF4444' };
      default:
        return { name: 'cash-outline', color: '#6B7280' };
    }
  };

  const getTransactionDescription = () => {
    switch (transaction.type) {
      case 'deposit':
        return 'Depósito';
      case 'withdrawal':
        return 'Saque';
      case 'prize':
        return 'Prêmio';
      case 'bet_payment':
        return 'Aposta';
      case 'share_sale':
        return 'Venda de Cota';
      case 'share_purchase':
        return 'Compra de Cota';
      default:
        return 'Transação';
    }
  };

  const icon = getTransactionIcon();
  const isPositive = transaction.amount > 0;

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: icon.color + '15' }]}>
        <Ionicons name={icon.name as any} size={24} color={icon.color} />
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.description}>{getTransactionDescription()}</Text>
        <Text style={styles.details}>{transaction.description}</Text>
        <Text style={styles.date}>
          {transaction.date.toLocaleDateString('pt-BR')}
        </Text>
      </View>
      
      <View style={styles.amountContainer}>
        <Text style={[
          styles.amount, 
          { color: isPositive ? '#10B981' : '#EF4444' }
        ]}>
          {isPositive ? '+' : ''}R$ {Math.abs(transaction.amount).toFixed(2)}
        </Text>
        <View style={[
          styles.statusBadge, 
          { 
            backgroundColor: transaction.status === 'completed' ? '#10B981' : 
                           transaction.status === 'pending' ? '#F59E0B' : '#EF4444'
          }
        ]}>
          <Text style={styles.statusText}>
            {transaction.status === 'completed' ? 'Concluído' : 
             transaction.status === 'pending' ? 'Pendente' : 'Cancelado'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContainer: {
    flex: 1,
  },
  description: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  details: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
