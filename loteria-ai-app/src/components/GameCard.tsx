import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GameType } from '../types';

interface GameCardProps {
  gameType: GameType;
  name: string;
  color: string;
  icon: string;
  lastResult?: number[];
  onPress?: () => void;
}

export const GameCard: React.FC<GameCardProps> = ({ 
  gameType, 
  name, 
  color, 
  icon,
  lastResult,
  onPress 
}) => {
  return (
    <TouchableOpacity 
      style={[styles.card, { borderLeftColor: color }]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <Text style={styles.gameName}>{name}</Text>
      </View>
      
      {lastResult && lastResult.length > 0 && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultLabel}>Último resultado:</Text>
          <View style={styles.numbersRow}>
            {lastResult.slice(0, 6).map((num, index) => (
              <View key={index} style={[styles.numberBall, { backgroundColor: color }]}>
                <Text style={styles.numberText}>{num}</Text>
              </View>
            ))}
            {lastResult.length > 6 && (
              <Text style={styles.moreNumbers}>+{lastResult.length - 6}</Text>
            )}
          </View>
        </View>
      )}
      
      <View style={styles.actionButton}>
        <Text style={styles.actionText}>Gerar com IA</Text>
        <Ionicons name="sparkles" size={16} color={color} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  gameName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  resultContainer: {
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  numbersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  numberBall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    marginBottom: 6,
  },
  numberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  moreNumbers: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
});
