import React, { useEffect, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { apiGet } from '../../services/api';
import { PaginatedResponse, Purchase } from '../../types';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { SearchBar } from '../../components/SearchBar';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';

export function PurchasesScreen() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  async function loadPurchases(query = search) {
    try {
      const res = await apiGet<PaginatedResponse<Purchase>>('/purchases', {
        search: query || undefined,
        limit: 50,
      });
      setPurchases(res.items ?? []);
    } catch {
      setPurchases([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPurchases(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function onRefresh() {
    setRefreshing(true);
    void loadPurchases();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Órdenes de Compra</Text>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar compra por código o proveedor…" />
      </View>

      {loading && !refreshing ? (
        <LoadingState message="Cargando órdenes de compra…" />
      ) : (
        <FlatList
          data={purchases}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState title="Sin compras" message="No se encontraron órdenes de compra en el sistema." />
          }
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.code}>{item.code}</Text>
                <Badge
                  label={item.status}
                  variant={
                    item.status === 'RECEIVED'
                      ? 'success'
                      : item.status === 'ORDERED'
                      ? 'info'
                      : 'warning'
                  }
                />
              </View>

              <Text style={styles.supplier}>{item.supplierName || 'Proveedor'}</Text>

              <View style={styles.footer}>
                <Text style={styles.dateText}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                </Text>
                <Text style={styles.totalText}>${item.total.toLocaleString()}</Text>
              </View>
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
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
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
  supplier: {
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
