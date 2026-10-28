import React, { useEffect, useState } from 'react';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RootStackParamList } from '../../navigation/types';
import { apiGet, apiPatch, apiPost } from '../../services/api';
import type { Category, Product } from '../../types';
import { PRODUCT_UNITS } from '@erp/validation';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { ScannerModal } from '../../components/ScannerModal';
import { LoadingState } from '../../components/LoadingState';

const unitLabels: Record<(typeof PRODUCT_UNITS)[number], string> = {
  pza: 'Pieza (pza)', kg: 'Kilogramo (kg)', g: 'Gramo (g)', l: 'Litro (l)', ml: 'Mililitro (ml)',
  m: 'Metro (m)', cm: 'Centímetro (cm)', m2: 'Metro cuadrado (m²)', m3: 'Metro cúbico (m³)',
  caja: 'Caja', paquete: 'Paquete', par: 'Par', docena: 'Docena', servicio: 'Servicio',
};

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
  const [unit, setUnit] = useState<string>('pza');
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);

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
          const storedUnit = prod.unit ?? 'pza';
          if (PRODUCT_UNITS.some((option) => option === storedUnit)) setUnit(storedUnit);
          else { setUnit(''); setError(`La unidad actual "${storedUnit}" no está estandarizada. Selecciona una unidad válida para guardar.`); }
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
    if (!PRODUCT_UNITS.some((option) => option === unit)) {
      setError('Selecciona una unidad de medida de la lista.');
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
      unit,
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

        <View style={styles.unitField}>
          <Text style={styles.unitLabel}>Unidad de Medida</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Elegir unidad de medida" style={styles.unitPicker} onPress={() => setUnitPickerVisible(true)}>
            <Text style={styles.unitPickerText}>{unit && unit in unitLabels ? unitLabels[unit as keyof typeof unitLabels] : 'Selecciona una unidad'}</Text>
            <Text style={styles.unitPickerChevron}>⌄</Text>
          </Pressable>
        </View>

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

      <Modal visible={unitPickerVisible} transparent animationType="slide" onRequestClose={() => setUnitPickerVisible(false)}>
        <View style={styles.unitModalBackdrop}>
          <View style={styles.unitModal}>
            <Text style={styles.unitModalTitle}>Unidad de medida</Text>
            <ScrollView>
              {PRODUCT_UNITS.map((option) => (
                <Pressable key={option} accessibilityRole="button" style={styles.unitOption} onPress={() => { setUnit(option); setUnitPickerVisible(false); }}>
                  <Text style={styles.unitOptionText}>{unitLabels[option]}</Text>
                  {unit === option ? <Text style={styles.unitSelected}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.unitCancel} onPress={() => setUnitPickerVisible(false)}><Text style={styles.unitCancelText}>Cancelar</Text></Pressable>
          </View>
        </View>
      </Modal>

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
  unitField: { marginBottom: 12 },
  unitLabel: { color: '#334155', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  unitPicker: { minHeight: 46, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unitPickerText: { color: '#0f172a', fontSize: 14 },
  unitPickerChevron: { color: '#64748b', fontSize: 20 },
  unitModalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  unitModal: { maxHeight: '75%', backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20 },
  unitModalTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800', marginBottom: 10 },
  unitOption: { minHeight: 46, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unitOptionText: { color: '#334155', fontSize: 14 },
  unitSelected: { color: '#047857', fontWeight: '800', fontSize: 18 },
  unitCancel: { alignItems: 'center', padding: 14, marginTop: 8 },
  unitCancelText: { color: '#047857', fontWeight: '700' },
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
