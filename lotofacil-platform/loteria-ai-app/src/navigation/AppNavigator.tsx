import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '../screens/HomeScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export const AppNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Carteira') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'Histórico') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'Perfil') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-circle-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e5e5e5',
          paddingTop: 8,
          paddingBottom: 8,
          height: 65,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        headerStyle: {
          backgroundColor: '#10B981',
          shadowColor: '#10B981',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 4,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          title: 'Início',
          headerTitle: 'Loteria AI',
        }}
      />
      <Tab.Screen 
        name="Carteira" 
        component={WalletScreen}
        options={{
          title: 'Carteira',
          headerTitle: 'Minha Carteira',
        }}
      />
      <Tab.Screen 
        name="Histórico" 
        component={HistoryScreen}
        options={{
          title: 'Histórico',
          headerTitle: 'Meus Jogos',
        }}
      />
      <Tab.Screen 
        name="Perfil" 
        component={ProfileScreen}
        options={{
          title: 'Perfil',
          headerTitle: 'Meu Perfil',
        }}
      />
    </Tab.Navigator>
  );
};
