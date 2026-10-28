import React, { useEffect, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getActiveApiUrl, setCustomApiUrl, signIn } from '../../services/api';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [serverUrlModal, setServerUrlModal] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState('');
  const [currentApiUrl, setCurrentApiUrl] = useState('');

  useEffect(() => {
    const url = getActiveApiUrl();
    setCurrentApiUrl(url);
    setServerUrlInput(url);
  }, []);

  async function handleLogin() {
    if (!email || !password) {
      setError('Por favor ingresa tu correo y contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signIn(email.trim(), password, companyId.trim() || undefined);
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveServerUrl() {
    if (!serverUrlInput.trim()) return;
    await setCustomApiUrl(serverUrlInput.trim());
    const updated = getActiveApiUrl();
    setCurrentApiUrl(updated);
    setServerUrlInput(updated);
    setServerUrlModal(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable style={styles.configBtn} onPress={() => setServerUrlModal(true)}>
            <Text style={styles.configBtnText}>⚙️ Servidor API</Text>
          </Pressable>
        </View>

        <View style={styles.header}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>D</Text>
          </View>
          <Text style={styles.title}>DATA ERP Móvil</Text>
          <Text style={styles.subtitle}>Administración empresarial en tiempo real</Text>
          <Text style={styles.serverInfoText}>Conectado a: {currentApiUrl}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Iniciar Sesión</Text>

          <Input
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            placeholder="usuario@empresa.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />

          <Input
            label="ID de Empresa (Opcional)"
            value={companyId}
            onChangeText={setCompanyId}
            placeholder="ID de la empresa si tienes varias"
            autoCapitalize="none"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button
            title={loading ? 'Iniciando sesión…' : 'Ingresar al sistema'}
            onPress={() => void handleLogin()}
            loading={loading}
            style={styles.submitButton}
          />
        </View>
      </ScrollView>

      <Modal visible={serverUrlModal} animationType="slide" transparent onRequestClose={() => setServerUrlModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configurar Servidor API</Text>
            <Text style={styles.modalSub}>
              Ingresa el dominio HTTPS de tu backend en Render / Cloudflare o tu IP local de Wi-Fi:
            </Text>

            <Input
              label="URL Base de la API"
              value={serverUrlInput}
              onChangeText={setServerUrlInput}
              placeholder="https://tu-dominio.com/api/v1"
              autoCapitalize="none"
            />

            <View style={styles.modalActions}>
              <Button title="Guardar Servidor" onPress={() => void handleSaveServerUrl()} />
              <Button title="Cancelar" onPress={() => setServerUrlModal(false)} variant="outline" />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 24,
    justifyContent: 'center',
    flexGrow: 1,
  },
  topBar: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  configBtn: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  configBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#1d493d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandMarkText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  serverInfoText: {
    fontSize: 11,
    color: '#0284c7',
    fontWeight: '600',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
  },
  submitButton: {
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  modalActions: {
    marginTop: 12,
    gap: 8,
  },
});
