import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, restoreSession, signIn, signOut } from './services/api';

type Dashboard = {
  ventasHoy: number;
  ventasMes: number;
  comprasMes: number;
  stockBajo: number;
  productosAgotados: number;
  inventarioValorizado: number;
};
type Row = Record<string, unknown>;
type ModuleKey = 'dashboard' | 'products' | 'inventory' | 'sales' | 'purchases';
const MODULES: Record<Exclude<ModuleKey, 'dashboard'>, { title: string; endpoint: string }> = {
  products: { title: 'Productos', endpoint: '/products?limit=20' },
  inventory: { title: 'Inventario', endpoint: '/inventory/stock?limit=20' },
  sales: { title: 'Ventas', endpoint: '/sales?limit=20' },
  purchases: { title: 'Compras', endpoint: '/purchases?limit=20' },
};

function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError('');
    try {
      await signIn(email, password, companyId || undefined);
      onLogin();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.login}>
      <Text style={styles.logo}>NEXUS</Text>
      <Text style={styles.title}>Operación en movimiento.</Text>
      <TextInput style={styles.input} placeholder="Correo" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Contraseña" secureTextEntry value={password} onChangeText={setPassword} />
      <TextInput style={styles.input} placeholder="ID de empresa (si tu correo está en varias)" autoCapitalize="none" value={companyId} onChangeText={setCompanyId} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} disabled={loading} onPress={() => void submit()}>
        <Text style={styles.buttonText}>{loading ? 'Entrando…' : 'Entrar'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function ResourceList({ moduleKey }: { moduleKey: Exclude<ModuleKey, 'dashboard'> }) {
  const resource = MODULES[moduleKey];
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api<{ items: Row[] }>(resource.endpoint)
      .then((result) => { if (active) setItems(result.items ?? []); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [resource.endpoint]);

  return (
    <View style={styles.panel}>
      <Text style={styles.section}>{resource.title}</Text>
      {loading ? <Text style={styles.subtitle}>Cargando datos…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && items.length === 0 ? <Text style={styles.subtitle}>No hay registros.</Text> : null}
      {items.map((item, index) => (
        <View style={styles.listRow} key={String(item.id ?? index)}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{String(item.name ?? item.productName ?? item.customerName ?? item.supplierName ?? item.productSku ?? 'Registro')}</Text>
            <Text style={styles.subtitle}>{String(item.status ?? item.type ?? item.sku ?? item.id ?? '')}</Text>
          </View>
          <Text style={styles.rowValue}>{String(item.quantity ?? item.total ?? '')}</Text>
        </View>
      ))}
    </View>
  );
}

function App() {
  const [user, setUser] = useState<Record<string, unknown> | null | undefined>(undefined);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dashboardError, setDashboardError] = useState('');
  const [moduleKey, setModuleKey] = useState<ModuleKey>('dashboard');

  useEffect(() => {
    restoreSession()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);
  useEffect(() => {
    if (!user) return;
    api<Dashboard>('/dashboard/summary')
      .then(setDashboard)
      .catch((reason) => setDashboardError(reason instanceof Error ? reason.message : 'No se pudo cargar el dashboard'));
  }, [user]);

  if (user === undefined) return <Text style={styles.loading}>Cargando…</Text>;
  if (!user) return <Login onLogin={() => { setModuleKey('dashboard'); setUser({}); }} />;

  const metrics = [
    ['Ventas hoy', dashboard?.ventasHoy],
    ['Ventas mes', dashboard?.ventasMes],
    ['Compras mes', dashboard?.comprasMes],
    ['Stock bajo', dashboard?.stockBajo],
    ['Agotados', dashboard?.productosAgotados],
    ['Inventario', dashboard?.inventarioValorizado],
  ];
  const navItems: Exclude<ModuleKey, 'dashboard'>[] = ['products', 'inventory', 'sales', 'purchases'];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.logo}>NEXUS ERP</Text>
        <Text style={styles.title}>{moduleKey === 'dashboard' ? 'Resumen' : MODULES[moduleKey].title}</Text>
        {moduleKey === 'dashboard' ? (
          <>
            <Text style={styles.subtitle}>Visión rápida de tu operación.</Text>
            {dashboardError ? <Text style={styles.error}>{dashboardError}</Text> : null}
            <View style={styles.grid}>
              {metrics.map(([label, value]) => <View style={styles.card} key={String(label)}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value === undefined ? '—' : String(value)}</Text></View>)}
            </View>
          </>
        ) : <ResourceList moduleKey={moduleKey} />}
        <Text style={styles.section}>Módulos</Text>
        <View style={styles.actions}>
          <Pressable style={[styles.action, moduleKey === 'dashboard' && styles.selected]} onPress={() => setModuleKey('dashboard')}><Text>Inicio</Text></Pressable>
          {navItems.map((key) => <Pressable style={[styles.action, moduleKey === key && styles.selected]} key={key} onPress={() => setModuleKey(key)}><Text>{MODULES[key].title}</Text></Pressable>)}
        </View>
        <Pressable style={styles.logout} onPress={() => { void signOut().finally(() => setUser(null)); }}><Text style={styles.logoutText}>Cerrar sesión</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f4ef' },
  content: { padding: 24, paddingBottom: 40 },
  login: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f7f5ed' },
  loading: { flex: 1, textAlign: 'center', paddingTop: 100, color: '#1d493d' },
  logo: { fontWeight: '700', letterSpacing: 2, color: '#1d493d', fontSize: 16 },
  title: { fontSize: 32, fontWeight: '700', color: '#18221f', marginTop: 18 },
  subtitle: { color: '#758078', marginTop: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccd8cf', padding: 14, marginTop: 16 },
  button: { backgroundColor: '#1d493d', padding: 16, marginTop: 20, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b53c2a', marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 28 },
  card: { backgroundColor: '#fffdf7', borderWidth: 1, borderColor: '#dce3dc', padding: 16, width: '47%', minHeight: 100 },
  label: { color: '#718077', fontSize: 12 },
  value: { fontSize: 25, fontWeight: '700', marginTop: 16, color: '#18221f' },
  section: { fontSize: 20, fontWeight: '700', marginTop: 30, marginBottom: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  action: { padding: 14, backgroundColor: '#ead6bd' },
  selected: { backgroundColor: '#c6ddca' },
  panel: { backgroundColor: '#fffdf7', padding: 16, marginTop: 18, borderWidth: 1, borderColor: '#dce3dc' },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e6ebe5' },
  rowText: { flex: 1, paddingRight: 12 },
  rowTitle: { color: '#18221f', fontWeight: '600' },
  rowValue: { color: '#1d493d', fontWeight: '700' },
  logout: { marginTop: 32, padding: 16, alignItems: 'center' },
  logoutText: { color: '#1d493d', fontWeight: '700' },
});

export default App;
