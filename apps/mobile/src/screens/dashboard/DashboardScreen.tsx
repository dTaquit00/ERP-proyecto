import React, { useEffect, useState } from 'react';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiGet } from '../../services/api';
import { DashboardSummary } from '../../types';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { LoadingState } from '../../components/LoadingState';

export function DashboardScreen() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function loadDashboard() {
    try {
      const data = await apiGet<DashboardSummary>('/dashboard/summary');
      setSummary(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el resumen');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  function onRefresh() {
    setRefreshing(true);
    void loadDashboard();
  }

  if (loading && !refreshing) {
    return <LoadingState message="Cargando resumen del ERP…" />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1d493d']} />}
      >
        <Text style={styles.pageTitle}>Resumen General</Text>
        <Text style={styles.subtitle}>Métricas principales de operación</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.grid}>
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Ventas Hoy</Text>
            <Text style={styles.kpiValue}>${summary?.ventasHoy?.toLocaleString() ?? 0}</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Ventas Mes</Text>
            <Text style={styles.kpiValue}>${summary?.ventasMes?.toLocaleString() ?? 0}</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Compras Mes</Text>
            <Text style={styles.kpiValue}>${summary?.comprasMes?.toLocaleString() ?? 0}</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Stock Bajo</Text>
            <Text style={[styles.kpiValue, (summary?.stockBajo ?? 0) > 0 && styles.warningText]}>
              {summary?.stockBajo ?? 0}
            </Text>
          </Card>

          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Agotados</Text>
            <Text style={[styles.kpiValue, (summary?.productosAgotados ?? 0) > 0 && styles.dangerText]}>
              {summary?.productosAgotados ?? 0}
            </Text>
          </Card>

          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Valor Inventario</Text>
            <Text style={styles.kpiValue}>${summary?.inventarioValorizado?.toLocaleString() ?? 0}</Text>
          </Card>
        </View>

        {summary?.ventasRecientes && summary.ventasRecientes.length > 0 ? (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Últimas Ventas</Text>
            {summary.ventasRecientes.map((sale) => (
              <Card key={sale.id} style={styles.saleRow}>
                <View style={styles.saleMain}>
                  <Text style={styles.saleCode}>{sale.code}</Text>
                  <Text style={styles.customerName}>{sale.customerName}</Text>
                </View>
                <View style={styles.saleEnd}>
                  <Text style={styles.saleTotal}>${sale.total.toLocaleString()}</Text>
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
              </Card>
            ))}
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
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  kpiCard: {
    width: '48%',
    padding: 14,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 8,
  },
  warningText: {
    color: '#d97706',
  },
  dangerText: {
    color: '#dc2626',
  },
  recentSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 10,
  },
  saleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  saleMain: {
    flex: 1,
  },
  saleCode: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  customerName: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  saleEnd: {
    alignItems: 'flex-end',
  },
  saleTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1d493d',
    marginBottom: 4,
  },
});
