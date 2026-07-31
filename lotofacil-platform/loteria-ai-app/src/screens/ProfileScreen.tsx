import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export const ProfileScreen: React.FC = () => {
  const { user, userProfile, refreshData } = useApp();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const menuItems = [
    { icon: 'person-outline', label: 'Dados Pessoais', screen: 'personal' },
    { icon: 'bank-outline', label: 'Conta Bancária', screen: 'bank' },
    { icon: 'shield-checkmark-outline', label: 'Segurança', screen: 'security' },
    { icon: 'notifications-outline', label: 'Notificações', screen: 'notifications' },
    { icon: 'help-circle-outline', label: 'Ajuda e Suporte', screen: 'help' },
    { icon: 'document-text-outline', label: 'Termos de Uso', screen: 'terms' },
  ];

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person" size={40} color="#fff" />
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        <TouchableOpacity style={styles.editProfileButton}>
          <Ionicons name="pencil" size={16} color="#10B981" />
          <Text style={styles.editProfileText}>Editar Perfil</Text>
        </TouchableOpacity>
      </View>

      {/* Financial Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumo Financeiro</Text>
        
        <View style={styles.financialCard}>
          <View style={styles.financialRow}>
            <View style={styles.financialInfo}>
              <Ionicons name="wallet" size={20} color="#10B981" />
              <Text style={styles.financialLabel}>Saldo Atual</Text>
            </View>
            <Text style={[styles.financialValue, { color: '#10B981' }]}>
              {formatCurrency(userProfile?.user.balance || 0)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.financialRow}>
            <View style={styles.financialInfo}>
              <Ionicons name="arrow-down-circle" size={20} color="#10B981" />
              <Text style={styles.financialLabel}>Total Depositado</Text>
            </View>
            <Text style={[styles.financialValue, { color: '#10B981' }]}>
              {formatCurrency(userProfile?.totalDeposits || 0)}
            </Text>
          </View>

          <View style={styles.financialRow}>
            <View style={styles.financialInfo}>
              <Ionicons name="arrow-up-circle" size={20} color="#EF4444" />
              <Text style={styles.financialLabel}>Total Sacado</Text>
            </View>
            <Text style={[styles.financialValue, { color: '#EF4444' }]}>
              {formatCurrency(userProfile?.totalWithdrawals || 0)}
            </Text>
          </View>

          <View style={styles.financialRow}>
            <View style={styles.financialInfo}>
              <Ionicons name="trophy" size={20} color="#F59E0B" />
              <Text style={styles.financialLabel}>Prêmios Ganhos</Text>
            </View>
            <Text style={[styles.financialValue, { color: '#F59E0B' }]}>
              {formatCurrency(userProfile?.totalPrizes || 0)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.financialRow}>
            <View style={styles.financialInfo}>
              <Ionicons name="people" size={20} color="#10B981" />
              <Text style={styles.financialLabel}>Ganho com Cotas</Text>
            </View>
            <Text style={[styles.financialValue, { color: '#10B981' }]}>
              {formatCurrency(userProfile?.totalEarnedFromShares || 0)}
            </Text>
          </View>

          <View style={styles.financialRow}>
            <View style={styles.financialInfo}>
              <Ionicons name="cart" size={20} color="#EF4444" />
              <Text style={styles.financialLabel}>Gasto com Cotas</Text>
            </View>
            <Text style={[styles.financialValue, { color: '#EF4444' }]}>
              {formatCurrency(userProfile?.totalSpentOnShares || 0)}
            </Text>
          </View>
        </View>
      </View>

      {/* Account Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informações da Conta</Text>
        
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>E-mail</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {user.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Telefone</Text>
                <Text style={styles.infoValue}>{user.phone}</Text>
              </View>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Conta criada em</Text>
              <Text style={styles.infoValue}>
                {user.createdAt.toLocaleDateString('pt-BR')}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configurações</Text>
        
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={item.screen} style={styles.menuItem}>
              <View style={styles.menuLeft}>
                <View style={styles.menuIconContainer}>
                  <Ionicons name={item.icon as any} size={20} color="#10B981" />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton}>
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text style={styles.logoutText}>Sair da Conta</Text>
      </TouchableOpacity>

      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Versão 1.0.0</Text>
        <Text style={styles.copyrightText}>© 2024 Loteria AI</Text>
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
    fontSize: 16,
    color: '#666',
  },
  profileHeader: {
    backgroundColor: '#10B981',
    paddingTop: 40,
    paddingBottom: 30,
    alignItems: 'center',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 16,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  editProfileText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  financialCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  financialInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  financialLabel: {
    fontSize: 14,
    color: '#666',
  },
  financialValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B98115',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 16,
    backgroundColor: '#EF444415',
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 12,
    color: '#bbb',
  },
});
