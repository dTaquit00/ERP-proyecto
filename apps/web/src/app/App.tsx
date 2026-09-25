import { useEffect, useState } from 'react';
import { bootstrap, login, logout, apiRequest } from '../services/api';
import '../theme.css';

type Dashboard = { ventasHoy: number; ventasMes: number; comprasMes: number; clientesActivos: number; proveedoresActivos: number; productosActivos: number; stockBajo: number; productosAgotados: number; inventarioValorizado: number };

type User = Record<string, unknown>;

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setLoading(true); setError(''); try { const result = await login(email, password); onLogin(result.user); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo iniciar sesión'); } finally { setLoading(false); } }
  return <main className="login-shell"><form className="login-card" onSubmit={submit}><div className="brand-mark">N</div><p className="eyebrow">NEXUS ERP</p><h1>Tu operación, en foco.</h1><p className="muted">Accede al centro de control de tu empresa.</p><label>Correo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="error">{error}</p>}<button className="primary" disabled={loading}>{loading ? 'Entrando...' : 'Iniciar sesión'}</button></form></main>;
}

function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined); const [dashboard, setDashboard] = useState<Dashboard | null>(null); const [error, setError] = useState('');
  useEffect(() => { bootstrap().then(setUser).catch(() => setUser(null)); }, []);
  useEffect(() => { if (user) apiRequest<Dashboard>('/dashboard/summary').then(setDashboard).catch((reason) => setError(reason instanceof Error ? reason.message : 'No se pudo cargar el dashboard')); }, [user]);
  if (user === undefined) return <div className="loading">Cargando espacio de trabajo...</div>;
  if (!user) return <Login onLogin={setUser} />;
  const cards = dashboard ? [['Ventas hoy', dashboard.ventasHoy.toFixed(2)], ['Ventas del mes', dashboard.ventasMes.toFixed(2)], ['Compras del mes', dashboard.comprasMes.toFixed(2)], ['Clientes activos', dashboard.clientesActivos], ['Stock bajo', dashboard.stockBajo], ['Agotados', dashboard.productosAgotados]] : [];
  return <div className="app-shell"><aside><div className="side-brand"><span className="brand-mark small">N</span><strong>NEXUS</strong></div><nav><a className="active">Resumen</a><a>Productos</a><a>Ventas</a><a>Compras</a><a>Inventario</a><a>Clientes</a><a>Proveedores</a><a>Reportes</a><a>Auditoría</a></nav><button className="ghost" onClick={() => logout().then(() => setUser(null))}>Cerrar sesión</button></aside><section className="workspace"><header><div><p className="eyebrow">CENTRO DE CONTROL</p><h1>Buenos días, {String(user.firstName ?? 'equipo')}</h1></div><div className="user-chip">{String(user.email ?? '')}</div></header><main className="content"><div className="section-heading"><div><h2>Resumen operativo</h2><p className="muted">Datos en tiempo real de tu empresa.</p></div><span className="status-dot">● Sistema operativo</span></div>{error && <p className="error">{error}</p>}<div className="metrics">{cards.map(([label, value]) => <article className="metric" key={String(label)}><span>{label}</span><strong>{value}</strong><small>Actualizado ahora</small></article>)}</div><div className="lower-grid"><article className="panel"><div className="panel-title"><h3>Inventario valorizado</h3><span>ACTUAL</span></div><strong className="big-number">{dashboard?.inventarioValorizado.toFixed(2) ?? '...'}</strong><p className="muted">Valor calculado con el costo de compra registrado.</p></article><article className="panel accent"><div className="panel-title"><h3>Catálogo activo</h3><span>PRODUCTOS</span></div><strong className="big-number">{dashboard?.productosActivos ?? '...'}</strong><p className="muted">Productos disponibles para operar.</p></article></div></main></section></div>;
}
export default App;
