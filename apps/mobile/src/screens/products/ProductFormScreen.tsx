import React, { useEffect, useState } from 'react';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../../navigation/types';
import { apiGet, apiPatch, apiPost } from '../../services/api';
import { Category, Product } from '../../types';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { ScannerModal } from '../../components/ScannerModal';
import { LoadingState } from '../../components/LoadingState';

type ProductFormScreenProps = {
  route: RouteProp<RootStackParamList, 'ProductForm'>;
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

export function ProductFormScreen({ route, navigation }: ProductFormScreenProps) {
  const productId = route.params?.productId;
  const isEditing = !!productId;

  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [taxPercentage, setTaxPercentage] = useState('0');
  const [unit, setUnit] = useState('UNIDAD');

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const catRes = await apiGet<{ items: Category[] }>('/categories');
        setCategories(catRes.items ?? []);

        if (productId) {
          const prod = await apiGet<Product>(`/products/${productId}`);
          setSku(prod.sku);
          setBarcode(prod.barcode ?? '');
          setName(prod.name);
          setDescription(prod.description ?? '');
          setCategoryId(prod.categoryId ?? '');
          setPurchasePrice(String(prod.purchasePrice));
          setSalePrice(String(prod.salePrice));
          setTaxPercentage(String(prod.taxPercentage));
          setUnit(prod.unit ?? 'UNIDAD');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error de carga');
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [productId]);

  async function handleSubmit() {
    if (!sku || !name || !salePrice) {
      setError('SKU, Nombre y Precio de Venta son obligatorios.');
      return;
    }

    setSubmitting(true);
    setError('');

    const payload = {
      sku: sku.trim(),
      barcode: barcode.trim() || undefined,
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId: categoryId || (categories[0]?.id ?? undefined),
      purchasePrice: parseFloat(purchasePrice) || 0,
      salePrice: parseFloat(salePrice) || 0,
      taxPercentage: parseFloat(taxPercentage) || 0,
      unit: unit.trim() || 'UNIDAD',
    };

    try {
      if (isEditing) {
        await apiPatch(`/products/${productId}`, payload);
      } else {
        await apiPost('/products', payload);
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar producto');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState message="Cargando formulario…" />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{isEditing ? 'Editar Producto' : 'Nuevo Producto'}</Text>

        <Input label="SKU *" value={sku} onChangeText={setSku} placeholder="EJ: PROD-001" autoCapitalize="characters" />

        <View style={styles.barcodeRow}>
          <View style={{ flex: 1 }}>
            <Input label="Código de Barras" value={barcode} onChangeText={setBarcode} placeholder="Escanear o ingresar" />
          </View>
          <Pressable style={styles.scanBtn} onPress={() => setScannerVisible(true)}>
            <Text style={styles.scanText}>📷 Escanear</Text>
          </Pressable>
        </View>

        <Input label="Nombre del Producto *" value={name} onChangeText={setName} placeholder="Nombre descriptivo" />

        <Input
          label="Precio de Venta ($) *"
          value={salePrice}
          onChangeText={setSalePrice}
          placeholder="0.00"
          keyboardType="numeric"
        />

        <Input
          label="Precio de Compra ($)"
          value={purchasePrice}
          onChangeText={setPurchasePrice}
          placeholder="0.00"
          keyboardType="numeric"
        />

        <Input
          label="Porcentaje de Impuesto (%)"
          value={taxPercentage}
          onChangeText={setTaxPercentage}
          placeholder="0"
          keyboardType="numeric"
        />

        <Input label="Unidad de Medida" value={unit} onChangeText={setUnit} placeholder="UNIDAD, KG, M, etc." />

        <Input
          label="Descripción"
          value={description}
          onChangeText={setDescription}
          placeholder="Detalles adicionales"
          multiline
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          title={submitting ? 'Guardando…' : 'Guardar Producto'}
          onPress={() => void handleSubmit()}
          loading={submitting}
          style={styles.submitBtn}
        />
      </ScrollView>

      <ScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={(code) => setBarcode(code)}
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
    marginBottom: 16,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  scanBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  scanText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 13,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 8,
  },
  submitBtn: {
    marginTop: 20,
  },
});
