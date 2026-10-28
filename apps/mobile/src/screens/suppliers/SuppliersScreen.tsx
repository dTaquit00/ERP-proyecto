import React, { useEffect, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { apiGet } from '../../services/api';
import { PaginatedResponse, Supplier } from '../../types';
import { Card } from '../../components/Card';
import { SearchBar } from '../../components/SearchBar';
import { Badge } from '../../components/Badge';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';

export function SuppliersScreen() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  async function loadSuppliers(query = search) {
    try {
      const res = await apiGet<PaginatedResponse<Supplier>>('/suppliers', {
        search: query || undefined,
        limit: 50,
      });
      setSuppliers(res.items ?? []);
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSuppliers(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function onRefresh() {
    setRefreshing(true);
    void loadSuppliers();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Directorio de Proveedores</Text>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar proveedor por nombre o RUC…" />
      </View>

      {loading && !refreshing ? (
        <LoadingState message="Cargando directorio de proveedores…" />
      ) : (
        <FlatList
          data={suppliers}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState title="Sin proveedores" message="No se encontraron proveedores registrados." />
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
              {item.contactName ? <Text style={styles.subText}>Contacto: {item.contactName}</Text> : null}
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
