import React, { useEffect, useState } from 'react';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { RootStackParamList } from '../../navigation/types';
import { apiGet, apiPatch, apiPost } from '../../services/api';
import { Customer } from '../../types';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/LoadingState';

type CustomerFormScreenProps = {
  route: RouteProp<RootStackParamList, 'CustomerForm'>;
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

export function CustomerFormScreen({ route, navigation }: CustomerFormScreenProps) {
  const customerId = route.params?.customerId;
  const isEditing = !!customerId;

  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (customerId) {
      apiGet<Customer>(`/customers/${customerId}`)
        .then((c) => {
          setName(c.name);
          setTaxId(c.taxId ?? '');
          setEmail(c.email ?? '');
          setPhone(c.phone ?? '');
          setAddress(c.address ?? '');
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Error'))
        .finally(() => setLoading(false));
    }
  }, [customerId]);

  async function handleSubmit() {
    if (!name) {
      setError('El nombre del cliente es obligatorio.');
      return;
    }

    setSubmitting(true);
    setError('');

    const payload = {
      name: name.trim(),
      taxId: taxId.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
    };

    try {
      if (isEditing) {
        await apiPatch(`/customers/${customerId}`, payload);
      } else {
        await apiPost('/customers', payload);
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar cliente');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState message="Cargando cliente…" />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}</Text>

        <Input label="Nombre o Razón Social *" value={name} onChangeText={setName} placeholder="Ej: Comercial S.A." />
        <Input label="Identificación Fiscal / RUC" value={taxId} onChangeText={setTaxId} placeholder="Ej: 20123456789" />
        <Input label="Correo Electrónico" value={email} onChangeText={setEmail} placeholder="contacto@cliente.com" keyboardType="email-address" autoCapitalize="none" />
        <Input label="Teléfono" value={phone} onChangeText={setPhone} placeholder="+51 987654321" keyboardType="phone-pad" />
        <Input label="Dirección" value={address} onChangeText={setAddress} placeholder="Av. Principal 123" multiline />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          title={submitting ? 'Guardando…' : 'Guardar Cliente'}
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
    marginBottom: 16,
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
