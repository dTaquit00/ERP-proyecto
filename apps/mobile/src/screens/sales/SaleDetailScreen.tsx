import React, { useEffect, useState } from 'react';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../../navigation/types';
import { apiGet, apiPost } from '../../services/api';
import { Sale } from '../../types';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/LoadingState';

type SaleDetailScreenProps = {
  route: RouteProp<RootStackParamList, 'SaleDetail'>;
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

export function SaleDetailScreen({ route, navigation }: SaleDetailScreenProps) {
  const { saleId } = route.params;
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function loadDetail() {
    try {
      const data = await apiGet<Sale>(`/sales/${saleId}`);
      setSale(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la venta');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [saleId]);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await apiPost(`/sales/${saleId}/confirm`);
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar la venta');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    setSubmitting(true);
    try {
      await apiPost(`/sales/${saleId}/cancel`);
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al anular la venta');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState message="Cargando detalle de la venta…" />;

  if (error || !sale) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Venta no encontrada'}</Text>
          <Button title="Volver" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{sale.code}</Text>
          <Badge
            label={sale.status}
            variant={
              sale.status === 'CONFIRMED'
                ? 'success'
                : sale.status === 'DRAFT'
                ? 'warning'
                : 'danger'
            }
          />
        </View>

        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Cliente</Text>
            <Text style={styles.value}>{sale.customerName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Almacén</Text>
            <Text style={styles.value}>{sale.warehouseName || 'Almacén Principal'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Fecha</Text>
            <Text style={styles.value}>
              {sale.createdAt ? new Date(sale.createdAt).toLocaleString() : ''}
            </Text>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Artículos ({sale.items?.length ?? 0})</Text>

        {sale.items?.map((item, idx) => (
          <Card key={item.id || idx} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemProdName}>{item.productName}</Text>
              <Text style={styles.itemProdTotal}>${item.total.toLocaleString()}</Text>
            </View>
            <Text style={styles.itemSubText}>
              {item.quantity} x ${item.unitPrice.toLocaleString()} (Imp: {item.taxPercentage}%)
            </Text>
          </Card>
        ))}

        <Card style={styles.summaryCard}>
          <View style={styles.row}>
            <Text style={styles.label}>Subtotal</Text>
            <Text style={styles.value}>${sale.subtotal.toLocaleString()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Impuestos</Text>
            <Text style={styles.value}>${sale.taxTotal.toLocaleString()}</Text>
          </View>
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>${sale.total.toLocaleString()}</Text>
          </View>
        </Card>

        {sale.status === 'DRAFT' ? (
          <View style={styles.actions}>
            <Button
              title={submitting ? 'Procesando…' : 'Confirmar Venta'}
              onPress={() => void handleConfirm()}
              loading={submitting}
            />
            <Button
              title="Anular Venta"
              onPress={() => void handleCancel()}
              variant="danger"
              disabled={submitting}
            />
          </View>
        ) : null}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  card: {
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 8,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  label: {
    fontSize: 14,
    color: '#64748b',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  itemCard: {
    padding: 12,
    marginBottom: 6,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemProdName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemProdTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1d493d',
  },
  itemSubText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  summaryCard: {
    marginTop: 12,
    padding: 16,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 10,
    marginTop: 6,
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
  actions: {
    marginTop: 16,
    gap: 8,
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
    marginBottom: 16,
  },
});
