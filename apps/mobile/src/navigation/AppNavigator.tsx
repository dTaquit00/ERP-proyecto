import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { TabNavigator } from './TabNavigator';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ProductDetailScreen } from '../screens/products/ProductDetailScreen';
import { ProductFormScreen } from '../screens/products/ProductFormScreen';
import { SaleDetailScreen } from '../screens/sales/SaleDetailScreen';
import { NewSaleScreen } from '../screens/sales/NewSaleScreen';
import { MovementFormScreen } from '../screens/inventory/MovementFormScreen';
import { CustomerFormScreen } from '../screens/customers/CustomerFormScreen';
import { PurchasesScreen } from '../screens/purchases/PurchasesScreen';
import { SuppliersScreen } from '../screens/suppliers/SuppliersScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface AppNavigatorProps {
  isAuthenticated: boolean;
  onLoginSuccess: () => void;
  onLogout: () => void;
}

export function AppNavigator({ isAuthenticated, onLoginSuccess, onLogout }: AppNavigatorProps) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: '#1d493d',
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: 'Atrás',
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" options={{ headerShown: false }}>
          {() => <LoginScreen onLoginSuccess={onLoginSuccess} />}
        </Stack.Screen>
      ) : (
        <>
          <Stack.Screen name="MainTabs" options={{ headerShown: false }}>
            {() => <TabNavigator onLogout={onLogout} />}
          </Stack.Screen>

          <Stack.Screen
            name="ProductDetail"
            component={ProductDetailScreen}
            options={{ title: 'Detalle de Producto' }}
          />

          <Stack.Screen
            name="ProductForm"
            component={ProductFormScreen}
            options={{ title: 'Formulario de Producto' }}
          />

          <Stack.Screen
            name="SaleDetail"
            component={SaleDetailScreen}
            options={{ title: 'Detalle de Venta' }}
          />

          <Stack.Screen
            name="NewSale"
            component={NewSaleScreen}
            options={{ title: 'Nueva Venta (POS)' }}
          />

          <Stack.Screen
            name="MovementForm"
            component={MovementFormScreen}
            options={{ title: 'Nuevo Movimiento' }}
          />

          <Stack.Screen
            name="CustomerForm"
            component={CustomerFormScreen}
            options={{ title: 'Formulario de Cliente' }}
          />

          <Stack.Screen
            name="Purchases"
            component={PurchasesScreen}
            options={{ title: 'Órdenes de Compra' }}
          />

          <Stack.Screen
            name="Suppliers"
            component={SuppliersScreen}
            options={{ title: 'Directorio de Proveedores' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
