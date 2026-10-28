import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { apiGet } from '../../services/api';
import { PaginatedResponse, Sale } from '../../types';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { SearchBar } from '../../components/SearchBar';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';

type SalesScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

export function SalesScreen({ navigation }: SalesScreenProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  async function loadSales(query = search) {
    try {
      const res = await apiGet<PaginatedResponse<Sale>>('/sales', {
        search: query || undefined,
        limit: 50,
      });
      setSales(res.items ?? []);
    } catch {
      setSales([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSales(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function onRefresh() {
    setRefreshing(true);
    void loadSales();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Ventas</Text>
          <Pressable style={styles.posButton} onPress={() => navigation.navigate('NewSale')}>
            <Text style={styles.posButtonText}>+ Nueva Venta (POS)</Text>
          </Pressable>
        </View>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar por código o cliente…" />
      </View>

      {loading && !refreshing ? (
        <LoadingState message="Cargando historial de ventas…" />
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              title="Sin ventas"
              message="No se encontraron registros de ventas."
              actionTitle="Registrar Nueva Venta"
              onAction={() => navigation.navigate('NewSale')}
            />
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('SaleDetail', { saleId: item.id })}>
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.code}>{item.code}</Text>
                  <Badge
                    label={item.status}
                    variant={
                      item.status === 'CONFIRMED'
                        ? 'success'
                        : item.status === 'DRAFT'
                        ? 'warning'
                        : 'danger'
                    }
                  />
                </View>

                <Text style={styles.customer}>{item.customerName || 'Cliente General'}</Text>

                <View style={styles.footer}>
                  <Text style={styles.dateText}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                  </Text>
                  <Text style={styles.totalText}>${item.total.toLocaleString()}</Text>
                </View>
              </Card>
            </Pressable>
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
  posButton: {
    backgroundColor: '#1d493d',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  posButtonText: {
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
    alignItems: 'center',
  },
  code: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  customer: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  dateText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  totalText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1d493d',
  },
});
