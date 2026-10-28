import React, { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiGet, signOut } from '../../services/api';
import { User } from '../../types';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/LoadingState';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';

interface SettingsScreenProps {
  onLogout: () => void;
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, 'More'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
}

export function SettingsScreen({ onLogout, navigation }: SettingsScreenProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<User>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function handleSignOut() {
    await signOut();
    onLogout();
  }

  if (loading) return <LoadingState message="Cargando perfil…" />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Más Opciones</Text>

        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'Usuario Autenticado'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'Sin correo'}</Text>
        </Card>

        <Text style={styles.sectionHeader}>Módulos Adicionales</Text>

        <Pressable style={styles.menuRow} onPress={() => navigation.navigate('Purchases')}>
          <Text style={styles.menuText}>🛒 Órdenes de Compra</Text>
          <Text style={styles.menuArrow}>›</Text>
        </Pressable>

        <Pressable style={styles.menuRow} onPress={() => navigation.navigate('Suppliers')}>
          <Text style={styles.menuText}>🏬 Directorio de Proveedores</Text>
          <Text style={styles.menuArrow}>›</Text>
        </Pressable>

        <Text style={styles.sectionHeader}>Sistema y Sesión</Text>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>Información de Conexión</Text>
          <Text style={styles.infoSub}>
            Servidor API: {process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}
          </Text>
          <Text style={styles.infoSub}>Versión App: 1.0.0 (Expo SDK 56)</Text>
        </Card>

        <Button
          title="Cerrar Sesión"
          onPress={() => void handleSignOut()}
          variant="danger"
          style={styles.logoutBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
  },
  profileCard: {
    alignItems: 'center',
    padding: 20,
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1d493d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 8,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  menuArrow: {
    fontSize: 20,
    color: '#94a3b8',
  },
  infoCard: {
    padding: 14,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  infoSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  logoutBtn: {
    marginTop: 8,
  },
});
