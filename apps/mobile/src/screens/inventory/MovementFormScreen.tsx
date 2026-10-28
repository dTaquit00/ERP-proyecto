import React, { useEffect, useState } from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../../navigation/types';
import { apiGet, apiPost } from '../../services/api';
import { Product, Warehouse } from '../../types';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';

type MovementFormScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

export function MovementFormScreen({ navigation }: MovementFormScreenProps) {
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER'>('IN');
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedTargetWarehouseId, setSelectedTargetWarehouseId] = useState('');

  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, whRes] = await Promise.all([
          apiGet<{ items: Product[] }>('/products', { limit: 100 }),
          apiGet<{ items: Warehouse[] }>('/warehouses'),
        ]);
        const prods = prodRes.items ?? [];
        const whs = whRes.items ?? [];
        setProducts(prods);
        setWarehouses(whs);
        if (prods.length > 0 && prods[0]) setSelectedProductId(prods[0].id);
        if (whs.length > 0 && whs[0]) setSelectedWarehouseId(whs[0].id);
        if (whs.length > 1 && whs[1]) setSelectedTargetWarehouseId(whs[1].id);
      } catch {
        setError('Error al cargar opciones de productos/almacenes');
      }
    }
    void loadData();
  }, []);

  async function handleSubmit() {
    const qtyNum = parseFloat(quantity);
    if (!selectedProductId || !selectedWarehouseId || isNaN(qtyNum) || qtyNum <= 0) {
      setError('Selecciona producto, almacén y una cantidad válida mayor a 0.');
      return;
    }
    if (type === 'TRANSFER' && (!selectedTargetWarehouseId || selectedTargetWarehouseId === selectedWarehouseId)) {
      setError('Para transferencias selecciona un almacén de destino distinto.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await apiPost('/inventory/movements', {
        type,
        productId: selectedProductId,
        warehouseId: selectedWarehouseId,
        targetWarehouseId: type === 'TRANSFER' ? selectedTargetWarehouseId : undefined,
        quantity: qtyNum,
        reason: reason.trim() || undefined,
      });

      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar movimiento');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Registrar Movimiento de Inventario</Text>

        <Card style={styles.card}>
          <Text style={styles.label}>Tipo de Movimiento</Text>
          <View style={styles.typeRow}>
            {(['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER'] as const).map((t) => (
              <Pressable
                key={t}
                style={[styles.typeChip, type === t && styles.activeTypeChip]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.typeText, type === t && styles.activeTypeText]}>
                  {t === 'IN'
                    ? 'Entrada'
                    : t === 'OUT'
                    ? 'Salida'
                    : t === 'ADJUSTMENT'
                    ? 'Ajuste'
                    : 'Transferencia'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Producto</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
            {products.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.chip, selectedProductId === p.id && styles.activeChip]}
                onPress={() => setSelectedProductId(p.id)}
              >
                <Text style={[styles.chipText, selectedProductId === p.id && styles.activeChipText]}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.label, { marginTop: 12 }]}>Almacén Origen</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
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

          {type === 'TRANSFER' ? (
            <>
              <Text style={[styles.label, { marginTop: 12 }]}>Almacén Destino</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
                {warehouses.map((w) => (
                  <Pressable
                    key={w.id}
                    style={[styles.chip, selectedTargetWarehouseId === w.id && styles.activeChip]}
                    onPress={() => setSelectedTargetWarehouseId(w.id)}
                  >
                    <Text style={[styles.chipText, selectedTargetWarehouseId === w.id && styles.activeChipText]}>
                      {w.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          <Input
            label="Cantidad *"
            value={quantity}
            onChangeText={setQuantity}
            placeholder="Ej: 10"
            keyboardType="numeric"
          />

          <Input
            label="Motivo / Observación"
            value={reason}
            onChangeText={setReason}
            placeholder="Ej: Recuento físico / Merma"
            multiline
          />
        </Card>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          title={submitting ? 'Guardando…' : 'Registrar Movimiento'}
          onPress={() => void handleSubmit()}
          loading={submitting}
          style={styles.submitBtn}
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
    marginBottom: 12,
  },
  card: {
    padding: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  typeChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeTypeChip: {
    backgroundColor: '#1d493d',
  },
  typeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  activeTypeText: {
    color: '#ffffff',
  },
  scrollRow: {
    flexDirection: 'row',
    marginBottom: 8,
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
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 8,
  },
  submitBtn: {
    marginTop: 16,
  },
});
