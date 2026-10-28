import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { apiGet } from '../../services/api';
import { PaginatedResponse, Product } from '../../types';
import { Card } from '../../components/Card';
import { SearchBar } from '../../components/SearchBar';
import { Badge } from '../../components/Badge';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';
import { ScannerModal } from '../../components/ScannerModal';

type ProductsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

export function ProductsScreen({ navigation }: ProductsScreenProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);

  async function loadProducts(query = search) {
    try {
      const res = await apiGet<PaginatedResponse<Product>>('/products', {
        search: query || undefined,
        limit: 50,
      });
      setProducts(res.items ?? []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadProducts(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function onRefresh() {
    setRefreshing(true);
    void loadProducts();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Catálogo de Productos</Text>
          <Pressable
            style={styles.addButton}
            onPress={() => navigation.navigate('ProductForm', {})}
          >
            <Text style={styles.addButtonText}>+ Nuevo</Text>
          </Pressable>
        </View>

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por SKU, nombre o código…"
          onScanPress={() => setScannerVisible(true)}
        />
      </View>

      {loading && !refreshing ? (
        <LoadingState message="Cargando catálogo…" />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              title="Sin productos"
              message="No se encontraron productos coincidentes."
              actionTitle="Registrar Producto"
              onAction={() => navigation.navigate('ProductForm', {})}
            />
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}>
              <Card style={styles.productCard}>
                <View style={styles.productHeader}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Badge
                    label={item.isActive ? 'Activo' : 'Inactivo'}
                    variant={item.isActive ? 'success' : 'danger'}
                  />
                </View>

                <View style={styles.productMeta}>
                  <Text style={styles.skuText}>SKU: {item.sku}</Text>
                  {item.categoryName ? (
                    <Text style={styles.categoryText}>| {item.categoryName}</Text>
                  ) : null}
                </View>

                <View style={styles.priceRow}>
                  <View>
                    <Text style={styles.priceLabel}>Precio Venta</Text>
                    <Text style={styles.priceValue}>${item.salePrice.toLocaleString()}</Text>
                  </View>
                  <View style={styles.alignRight}>
                    <Text style={styles.priceLabel}>Precio Compra</Text>
                    <Text style={styles.costValue}>${item.purchasePrice.toLocaleString()}</Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}

      <ScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={(barcode) => setSearch(barcode)}
      />
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
  addButton: {
    backgroundColor: '#1d493d',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  listContent: {
    padding: 16,
  },
  productCard: {
    padding: 14,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  skuText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  categoryText: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 6,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  priceLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1d493d',
    marginTop: 2,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  costValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginTop: 2,
  },
});
