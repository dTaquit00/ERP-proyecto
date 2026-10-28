import React, { useEffect, useState } from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../../navigation/types';
import { apiGet, apiPost } from '../../services/api';
import { Customer, Product, Warehouse } from '../../types';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ScannerModal } from '../../components/ScannerModal';

type NewSaleScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export function NewSaleScreen({ navigation }: NewSaleScreenProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');

  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);

  useEffect(() => {
    async function loadInitial() {
      try {
        const [custRes, whRes] = await Promise.all([
          apiGet<{ items: Customer[] }>('/customers'),
          apiGet<{ items: Warehouse[] }>('/warehouses'),
        ]);
        const custs = custRes.items ?? [];
        const whs = whRes.items ?? [];
        setCustomers(custs);
        setWarehouses(whs);
        if (custs.length > 0 && custs[0]) setSelectedCustomerId(custs[0].id);
        if (whs.length > 0 && whs[0]) setSelectedWarehouseId(whs[0].id);
      } catch {
        setError('No se pudieron cargar clientes o almacenes');
      }
    }
    void loadInitial();
  }, []);

  async function searchProducts(query: string) {
    if (!query) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await apiGet<{ items: Product[] }>('/products', { search: query, limit: 10 });
      setSearchResults(res.items ?? []);
    } catch {
      setSearchResults([]);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void searchProducts(productSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, unitPrice: product.salePrice }];
    });
    setProductSearch('');
    setSearchResults([]);
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  }

  const subtotal = cart.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  const taxTotal = cart.reduce(
    (acc, item) => acc + item.quantity * item.unitPrice * ((item.product.taxPercentage || 0) / 100),
    0
  );
  const total = subtotal + taxTotal;

  async function handleCreateSale(confirmImmediately = false) {
    if (cart.length === 0) {
      setError('Agrega al menos un producto al carrito.');
      return;
    }
    if (!selectedCustomerId || !selectedWarehouseId) {
      setError('Selecciona cliente y almacén.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        customerId: selectedCustomerId,
        warehouseId: selectedWarehouseId,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };

      const newSale = await apiPost<{ id: string }>('/sales', payload);

      if (confirmImmediately) {
        await apiPost(`/sales/${newSale.id}/confirm`);
      }

      navigation.replace('SaleDetail', { saleId: newSale.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar la venta');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Punto de Venta (POS)</Text>

        <Card style={styles.sectionCard}>
          <Text style={styles.label}>Cliente</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {customers.map((c) => (
              <Pressable
                key={c.id}
                style={[styles.chip, selectedCustomerId === c.id && styles.activeChip]}
                onPress={() => setSelectedCustomerId(c.id)}
              >
                <Text style={[styles.chipText, selectedCustomerId === c.id && styles.activeChipText]}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.label, { marginTop: 12 }]}>Almacén</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {warehouses.map((w) => (
              <Pressable
                key={w.id}
                style={[styles.chip, selectedWarehouseId === w.id && styles.activeChip]}
                onPress={() => setSelectedWarehouseId(w.id)}
              >
                <Text style={[styles.chipText, selectedWarehouseId === w.id && styles.activeChipText]}>
                  {w.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Card>

        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Buscar producto por SKU o nombre…"
              value={productSearch}
              onChangeText={setProductSearch}
            />
          </View>
          <Pressable style={styles.scanBtn} onPress={() => setScannerVisible(true)}>
            <Text style={styles.scanText}>📷</Text>
          </Pressable>
        </View>

        {searchResults.length > 0 ? (
          <Card style={styles.resultsCard}>
            {searchResults.map((prod) => (
              <Pressable key={prod.id} style={styles.resultRow} onPress={() => addToCart(prod)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prodName}>{prod.name}</Text>
                  <Text style={styles.prodSku}>SKU: {prod.sku}</Text>
                </View>
                <Text style={styles.prodPrice}>${prod.salePrice.toLocaleString()}</Text>
                <Text style={styles.addText}>+ Agregar</Text>
              </Pressable>
            ))}
          </Card>
        ) : null}

        <Text style={styles.sectionHeader}>Carrito de Compra ({cart.length})</Text>

        {cart.length === 0 ? (
          <Text style={styles.emptyCartText}>El carrito está vacío. Busca y agrega productos arriba.</Text>
        ) : (
          cart.map((item) => (
            <Card key={item.product.id} style={styles.cartCard}>
              <View style={styles.cartMain}>
                <Text style={styles.cartProdName}>{item.product.name}</Text>
                <Text style={styles.cartProdPrice}>${item.unitPrice.toLocaleString()}</Text>
              </View>

              <View style={styles.qtyRow}>
                <Pressable style={styles.qtyBtn} onPress={() => updateQuantity(item.product.id, -1)}>
                  <Text style={styles.qtyBtnText}>-</Text>
                </Pressable>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <Pressable style={styles.qtyBtn} onPress={() => updateQuantity(item.product.id, 1)}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </Pressable>

                <Text style={styles.itemTotal}>
                  ${(item.quantity * item.unitPrice).toLocaleString()}
                </Text>
              </View>
            </Card>
          ))
        )}

        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${subtotal.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Impuestos</Text>
            <Text style={styles.summaryValue}>${taxTotal.toLocaleString()}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>${total.toLocaleString()}</Text>
          </View>
        </Card>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          title={submitting ? 'Procesando…' : 'Confirmar Venta y Debitar Stock'}
          onPress={() => void handleCreateSale(true)}
          loading={submitting}
          style={styles.confirmBtn}
        />

        <Button
          title="Guardar como Borrador"
          onPress={() => void handleCreateSale(false)}
          variant="outline"
          disabled={submitting}
        />
      </ScrollView>

      <ScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={(barcode) => {
          setProductSearch(barcode);
          void searchProducts(barcode);
        }}
      />
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
    marginBottom: 12,
  },
  sectionCard: {
    padding: 12,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  activeChip: {
    backgroundColor: '#1d493d',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  activeChipText: {
    color: '#ffffff',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanBtn: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanText: {
    fontSize: 18,
  },
  resultsCard: {
    padding: 0,
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  prodName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  prodSku: {
    fontSize: 12,
    color: '#64748b',
  },
  prodPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1d493d',
    marginRight: 10,
  },
  addText: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 12,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyCartText: {
    color: '#64748b',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  cartCard: {
    padding: 12,
  },
  cartMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cartProdName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  cartProdPrice: {
    fontSize: 14,
    color: '#64748b',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtn: {
    backgroundColor: '#e2e8f0',
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  qtyText: {
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 12,
  },
  itemTotal: {
    marginLeft: 'auto',
    fontSize: 16,
    fontWeight: '800',
    color: '#1d493d',
  },
  summaryCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1d493d',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 8,
  },
  confirmBtn: {
    marginTop: 16,
  },
});
