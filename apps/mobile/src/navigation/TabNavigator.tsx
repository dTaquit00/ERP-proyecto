import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './types';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { SalesScreen } from '../screens/sales/SalesScreen';
import { ProductsScreen } from '../screens/products/ProductsScreen';
import { InventoryScreen } from '../screens/inventory/InventoryScreen';
import { CustomersScreen } from '../screens/customers/CustomersScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { Text } from 'react-native';

const Tab = createBottomTabNavigator<MainTabParamList>();

interface TabNavigatorProps {
  onLogout: () => void;
}

export function TabNavigator({ onLogout }: TabNavigatorProps) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1d493d',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          paddingBottom: 6,
          paddingTop: 6,
          height: 60,
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Inicio',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📊</Text>,
        }}
      />
      <Tab.Screen
        name="Sales"
        component={SalesScreen}
        options={{
          tabBarLabel: 'Ventas',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🏷️</Text>,
        }}
      />
      <Tab.Screen
        name="Products"
        component={ProductsScreen}
        options={{
          tabBarLabel: 'Productos',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📦</Text>,
        }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          tabBarLabel: 'Inventario',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🏬</Text>,
        }}
      />
      <Tab.Screen
        name="Customers"
        component={CustomersScreen}
        options={{
          tabBarLabel: 'Clientes',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>👥</Text>,
        }}
      />
      <Tab.Screen
        name="More"
        options={{
          tabBarLabel: 'Más',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⚙️</Text>,
        }}
      >
        {(props) => <SettingsScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
