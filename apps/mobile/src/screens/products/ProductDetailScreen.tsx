import React, { useEffect, useState } from 'react';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../../navigation/types';
import { apiGet } from '../../services/api';
import { Product } from '../../types';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/LoadingState';

type ProductDetailScreenProps = {
  route: RouteProp<RootStackParamList, 'ProductDetail'>;
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

export function ProductDetailScreen({ route, navigation }: ProductDetailScreenProps) {
  const { productId } = route.params;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDetail() {
    try {
      const data = await apiGet<Product>(`/products/${productId}`);
      setProduct(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el producto');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [productId]);

  if (loading) return <LoadingState message="Cargando detalle del producto…" />;

  if (error || !product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Producto no encontrado'}</Text>
          <Button title="Volver" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{product.name}</Text>
          <Badge
            label={product.isActive ? 'Activo' : 'Inactivo'}
            variant={product.isActive ? 'success' : 'danger'}
          />
        </View>

        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>SKU</Text>
            <Text style={styles.value}>{product.sku}</Text>
          </View>

          {product.barcode ? (
            <View style={styles.row}>
              <Text style={styles.label}>Código de Barras</Text>
              <Text style={styles.value}>{product.barcode}</Text>
            </View>
          ) : null}

          {product.categoryName ? (
            <View style={styles.row}>
              <Text style={styles.label}>Categoría</Text>
              <Text style={styles.value}>{product.categoryName}</Text>
            </View>
          ) : null}

          <View style={styles.row}>
            <Text style={styles.label}>Unidad de Medida</Text>
            <Text style={styles.value}>{product.unit || 'UNIDAD'}</Text>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Precios e Impuestos</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Precio de Venta</Text>
            <Text style={styles.priceHighlight}>${product.salePrice.toLocaleString()}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Precio de Compra</Text>
            <Text style={styles.value}>${product.purchasePrice.toLocaleString()}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Impuesto (%)</Text>
            <Text style={styles.value}>{product.taxPercentage}%</Text>
          </View>
        </Card>

        {product.description ? (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Descripción</Text>
            <Text style={styles.descriptionText}>{product.description}</Text>
          </Card>
        ) : null}

        <Button
          title="Editar Producto"
          onPress={() => navigation.navigate('ProductForm', { productId: product.id })}
          style={styles.editBtn}
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
    flex: 1,
    marginRight: 8,
  },
  card: {
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
  priceHighlight: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1d493d',
  },
  descriptionText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  editBtn: {
    marginTop: 12,
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
