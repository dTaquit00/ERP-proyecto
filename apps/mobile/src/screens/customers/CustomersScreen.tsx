import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { apiGet } from '../../services/api';
import { Customer, PaginatedResponse } from '../../types';
import { Card } from '../../components/Card';
import { SearchBar } from '../../components/SearchBar';
import { Badge } from '../../components/Badge';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';

type CustomersScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

export function CustomersScreen({ navigation }: CustomersScreenProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  async function loadCustomers(query = search) {
    try {
      const res = await apiGet<PaginatedResponse<Customer>>('/customers', {
        search: query || undefined,
        limit: 50,
      });
      setCustomers(res.items ?? []);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCustomers(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function onRefresh() {
    setRefreshing(true);
    void loadCustomers();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Directorio de Clientes</Text>
          <Pressable
            style={styles.addBtn}
            onPress={() => navigation.navigate('CustomerForm', {})}
          >
            <Text style={styles.addBtnText}>+ Nuevo</Text>
          </Pressable>
        </View>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar cliente por nombre o RUC…" />
      </View>

      {loading && !refreshing ? (
        <LoadingState message="Cargando directorio de clientes…" />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              title="Sin clientes"
              message="No se encontraron clientes registrados."
              actionTitle="Crear Cliente"
              onAction={() => navigation.navigate('CustomerForm', {})}
            />
          }
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.name}>{item.name}</Text>
                <Badge
                  label={item.isActive ? 'Activo' : 'Inactivo'}
                  variant={item.isActive ? 'success' : 'danger'}
                />
              </View>

              {item.taxId ? <Text style={styles.subText}>Doc/RUC: {item.taxId}</Text> : null}
              {item.phone ? <Text style={styles.subText}>Tel: {item.phone}</Text> : null}
              {item.email ? <Text style={styles.subText}>Email: {item.email}</Text> : null}
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  addBtn: {
    backgroundColor: '#1d493d',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  listContent: {
    padding: 16,
  },
  card: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  subText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
});
