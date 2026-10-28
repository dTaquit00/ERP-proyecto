import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { apiGet } from '../../services/api';
import { InventoryMovement, PaginatedResponse, StockBalance } from '../../types';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { SearchBar } from '../../components/SearchBar';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';

type InventoryScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

export function InventoryScreen({ navigation }: InventoryScreenProps) {
  const [tab, setTab] = useState<'stock' | 'movements'>('stock');

  const [stock, setStock] = useState<StockBalance[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  async function loadData(query = search) {
    try {
      if (tab === 'stock') {
        const res = await apiGet<PaginatedResponse<StockBalance>>('/inventory/stock', {
          search: query || undefined,
          limit: 50,
        });
        setStock(res.items ?? []);
      } else {
        const res = await apiGet<PaginatedResponse<InventoryMovement>>('/inventory/movements', {
          search: query || undefined,
          limit: 50,
        });
        setMovements(res.items ?? []);
      }
    } catch {
      setStock([]);
      setMovements([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void loadData(search);
  }, [tab, search]);

  function onRefresh() {
    setRefreshing(true);
    void loadData();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Control de Inventario</Text>
          <Pressable
            style={styles.actionBtn}
            onPress={() => navigation.navigate('MovementForm')}
          >
            <Text style={styles.actionBtnText}>+ Movimiento</Text>
          </Pressable>
        </View>

        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tab, tab === 'stock' && styles.activeTab]}
            onPress={() => setTab('stock')}
          >
            <Text style={[styles.tabText, tab === 'stock' && styles.activeTabText]}>
              Existencias
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'movements' && styles.activeTab]}
            onPress={() => setTab('movements')}
          >
            <Text style={[styles.tabText, tab === 'movements' && styles.activeTabText]}>
              Movimientos
            </Text>
          </Pressable>
        </View>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar producto o almacén…" />
      </View>

      {loading && !refreshing ? (
        <LoadingState message="Cargando datos de inventario…" />
      ) : tab === 'stock' ? (
        <FlatList
          data={stock}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<EmptyState title="Sin stock registrado" message="No hay existencias encontradas." />}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.prodName}>{item.productName || item.productSku}</Text>
                {item.isLowStock ? <Badge label="Stock Bajo" variant="warning" /> : null}
              </View>

              <Text style={styles.warehouseText}>Almacén: {item.warehouseName || 'Principal'}</Text>

              <View style={styles.stockRow}>
                <View style={styles.stockItem}>
                  <Text style={styles.stockLabel}>Físico</Text>
                  <Text style={styles.stockValue}>{item.quantity}</Text>
                </View>
                <View style={styles.stockItem}>
                  <Text style={styles.stockLabel}>Reservado</Text>
                  <Text style={styles.stockValue}>{item.reservedQuantity}</Text>
                </View>
                <View style={styles.stockItem}>
                  <Text style={styles.stockLabel}>Disponible</Text>
                  <Text style={styles.availValue}>{item.availableQuantity}</Text>
                </View>
              </View>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={movements}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<EmptyState title="Sin movimientos" message="No se han registrado movimientos." />}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.prodName}>{item.productName || item.productSku}</Text>
                <Badge
                  label={item.type}
                  variant={
                    item.type === 'IN' || item.type === 'RETURN'
                      ? 'success'
                      : item.type === 'OUT'
                      ? 'danger'
                      : 'info'
                  }
                />
              </View>

              <Text style={styles.warehouseText}>
                {item.warehouseName}
                {item.targetWarehouseName ? ` ➔ ${item.targetWarehouseName}` : ''}
              </Text>

              <View style={styles.stockRow}>
                <Text style={styles.dateText}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                </Text>
                <Text style={styles.movementQty}>Cantidad: {item.quantity}</Text>
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  actionBtn: {
    backgroundColor: '#1d493d',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 4,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#0f172a',
    fontWeight: '700',
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
  },
  prodName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  warehouseText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  stockItem: {
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  stockValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  availValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1d493d',
  },
  dateText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  movementQty: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
});
