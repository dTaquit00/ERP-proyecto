import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth, useResource } from '../auth/AuthProvider';
import { apiRequest, downloadReport } from '../services/api';
import { EntityFormPage } from './EntityForms';
import '../ui.css';
import '../theme.css';
import '../auth.css';

type Row = Record<string, unknown>;
const resources: Record<string, { label: string; endpoint: string; permission: string; searchable?: boolean }> = {
  products: { label: 'Productos', endpoint: '/products', permission: 'products.read', searchable: true }, categories: { label: 'Categorías', endpoint: '/categories', permission: 'categories.read', searchable: true }, customers: { label: 'Clientes', endpoint: '/customers', permission: 'customers.read', searchable: true }, suppliers: { label: 'Proveedores', endpoint: '/suppliers', permission: 'suppliers.read', searchable: true }, warehouses: { label: 'Almacenes', endpoint: '/warehouses', permission: 'warehouses.read', searchable: true }, branches: { label: 'Sucursales', endpoint: '/branches', permission: 'branches.read', searchable: true }, companies: { label: 'Empresa', endpoint: '/companies', permission: 'companies.read' }, sales: { label: 'Ventas', endpoint: '/sales', permission: 'sales.read', searchable: true }, purchases: { label: 'Compras', endpoint: '/purchases', permission: 'purchases.read' }, inventory: { label: 'Existencias', endpoint: '/inventory/stock', permission: 'inventory.read' }, users: { label: 'Usuarios', endpoint: '/users', permission: 'users.read', searchable: true }, roles: { label: 'Roles', endpoint: '/roles', permission: 'roles.read' }, audit: { label: 'Auditoría', endpoint: '/audit-logs', permission: 'audit.read' },
};

function LoginPage() { const { login } = useAuth(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [companyId, setCompanyId] = useState(''); const [error, setError] = useState(''); const navigate = useNavigate(); async function submit(event: React.FormEvent) { event.preventDefault(); setError(''); try { await login(email, password, companyId || undefined); navigate('/dashboard'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo iniciar sesión'); } } return <main className="login-shell"><form className="login-card" onSubmit={submit}><img className="brand-logo" src="/data-erp-logo.svg" alt="DATA ERP" /><h1>Tu operación, en foco.</h1><p className="muted">Accede al centro de control de tu empresa.</p><label>Correo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label>Empresa (opcional)<input value={companyId} onChange={(event) => setCompanyId(event.target.value)} placeholder="ID de empresa, si tu correo está en varias" /></label>{error && <p className="error">{error}</p>}<button className="primary">Iniciar sesión</button><Link className="auth-link" to="/forgot-password">¿Olvidaste tu contraseña?</Link></form></main>; }

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage(''); setError(''); setSending(true);
    try {
      const result = await apiRequest<{ message: string }>('/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email, ...(companyId ? { companyId } : {}) }) });
      setMessage(result.message);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo solicitar el enlace'); }
    finally { setSending(false); }
  }
  return <main className="login-shell"><form className="login-card" onSubmit={(event) => void submit(event)}><img className="brand-logo" src="/data-erp-logo.svg" alt="DATA ERP" /><h1>Recuperar contraseña</h1><p className="muted">Te enviaremos un enlace si encontramos una cuenta con esos datos.</p><label>Correo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Empresa (opcional)<input value={companyId} onChange={(event) => setCompanyId(event.target.value)} /></label>{message && <p className="success">{message}</p>}{error && <p className="error">{error}</p>}<button className="primary" disabled={sending}>{sending ? 'Enviando…' : 'Enviar enlace'}</button><Link className="auth-link" to="/login">Volver a iniciar sesión</Link></form></main>;
}

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage(''); setError(''); setSaving(true);
    try {
      const result = await apiRequest<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) });
      setMessage(result.message);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo cambiar la contraseña'); }
    finally { setSaving(false); }
  }
  return <main className="login-shell"><form className="login-card" onSubmit={(event) => void submit(event)}><img className="brand-logo" src="/data-erp-logo.svg" alt="DATA ERP" /><h1>Nueva contraseña</h1><p className="muted">Elige una contraseña segura para tu cuenta.</p>{token ? <label>Nueva contraseña<input type="password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label> : <p className="error">El enlace no contiene un token válido.</p>}{message && <p className="success">{message} <Link to="/login">Iniciar sesión</Link></p>}{error && <p className="error">{error}</p>}{token && !message && <button className="primary" disabled={saving}>{saving ? 'Guardando…' : 'Cambiar contraseña'}</button>}</form></main>;
}

function ChangePasswordPage() {
  const { logout } = useAuth(); const [currentPassword, setCurrentPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false); const navigate = useNavigate();
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(''); setMessage(''); if (newPassword !== confirmation) { setError('La confirmación no coincide con la nueva contraseña.'); return; } setSaving(true); try { await apiRequest<void>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }); setMessage('Contraseña actualizada. Inicia sesión nuevamente.'); await logout(); navigate('/login'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo cambiar la contraseña'); } finally { setSaving(false); } }
  return <div className="panel"><p className="eyebrow">CUENTA</p><h2>Cambiar contraseña</h2><p className="muted">Usa una contraseña nueva de al menos 12 caracteres.</p>{error && <ErrorState message={error} />}{message && <p className="success">{message}</p>}<form className="product-form" onSubmit={(event) => void submit(event)}><label>Contraseña actual<input type="password" autoComplete="current-password" maxLength={128} required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label>Confirmar nueva contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><div className="form-actions"><button className="primary" disabled={saving}>{saving ? 'Guardando…' : 'Actualizar contraseña'}</button></div></form></div>;
}

function Shell() {
  const { user, loading, logout, can } = useAuth();
  const location = useLocation();
  if (loading) return <div className="loading">Cargando espacio de trabajo...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const operationLinks = [
    ['/dashboard', 'Dashboard', true], ['/products', 'Productos', can('products.read')],
    ['/categories', 'Categorías', can('categories.read')], ['/customers', 'Clientes', can('customers.read')],
    ['/suppliers', 'Proveedores', can('suppliers.read')], ['/warehouses', 'Almacenes', can('warehouses.read')],
    ['/companies', 'Empresa', can('companies.read')], ['/branches', 'Sucursales', can('branches.read')], ['/inventory', 'Inventario', can('inventory.read')],
    ['/sales', 'Ventas', can('sales.read')], ['/purchases', 'Compras', can('purchases.read')],
    ['/reports', 'Reportes', can('reports.read')],
  ] as const;
  const adminLinks = [
    ['/users', 'Usuarios', can('users.read')], ['/roles', 'Roles', can('roles.read')], ['/audit', 'Auditoría', can('audit.read')],
  ] as const;
  const renderLinks = (links: readonly (readonly [string, string, boolean])[]) => links.filter((link) => link[2]).map(([path, label]) =>
    <Link className={location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path)) ? 'active' : ''} to={path} key={path}>{label}</Link>);

  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="side-brand" to="/dashboard" aria-label="DATA ERP, ir al dashboard"><img className="side-logo" src="/data-erp-logo.svg" alt="DATA ERP" /></Link>
      <div className="workspace-label"><span className="workspace-dot" /> ESPACIO DE TRABAJO</div>
      <nav aria-label="Navegación principal">
        <p className="nav-caption">OPERACIÓN</p>{renderLinks(operationLinks)}
        {adminLinks.some((link) => link[2]) && <><p className="nav-caption">ADMINISTRACIÓN</p>{renderLinks(adminLinks)}</>}
      </nav>
      <div className="sidebar-account"><div className="account-avatar">{user.firstName.slice(0, 1)}{user.lastName.slice(0, 1)}</div><div className="account-copy"><strong>{user.firstName} {user.lastName}</strong><span>{user.email}</span></div><button className="logout-button" onClick={() => void logout()} aria-label="Cerrar sesión" title="Cerrar sesión">↗</button></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><div className="breadcrumb"><span>DATA ERP</span><b>/</b><strong>{location.pathname === '/dashboard' ? 'Resumen' : location.pathname.split('/')[1]}</strong></div><div className="topbar-actions"><Link className="account-link" to="/change-password">Cambiar contraseña</Link><div className="user-chip"><span className="online-dot" /> Sistema conectado <span className="chip-divider" /> {user.email}</div></div></header>
      <main className="content"><Outlet /></main>
    </section>
  </div>;
}

function DashboardPage() {
  const { data, loading, error } = useResource<Row>('/dashboard/summary');
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const cards = [
    ['Ventas hoy', data?.ventasHoy, '$', 'violet'], ['Ventas mes', data?.ventasMes, '↗', 'magenta'],
    ['Compras mes', data?.comprasMes, '↙', 'gold'], ['Clientes activos', data?.clientesActivos, '◎', 'blue'],
    ['Proveedores activos', data?.proveedoresActivos, '◇', 'green'], ['Productos activos', data?.productosActivos, '▦', 'blue'],
    ['Stock bajo', data?.stockBajo, '!', 'orange'], ['Agotados', data?.productosAgotados, '×', 'red'],
    ['Inventario valorizado', data?.inventarioValorizado, '$', 'green'],
  ] as const;
  return <>
    <div className="dashboard-heading"><div><p className="eyebrow">VISTA GENERAL</p><h1>Resumen operativo</h1><p className="muted">Un vistazo a la actividad de tu empresa.</p></div><span className="status-pill"><span className="online-dot" /> API conectada</span></div>
    <section className="metrics" aria-label="Indicadores de operación">{cards.map(([label, value, icon, tone]) => <article className={`metric metric-${tone}`} key={label}><div className="metric-top"><span>{label}</span><span className="metric-icon" aria-hidden="true">{icon}</span></div><strong>{typeof value === 'number' ? value.toLocaleString('es-MX') : '-'}</strong><small><span className="metric-live-dot" /> Actualizado ahora</small></article>)}</section>
    <div className="dashboard-section-title"><div><p className="eyebrow">ACTIVIDAD</p><h2>Lo más reciente</h2></div></div>
    <div className="lower-grid"><Recent title="Ventas recientes" rows={(data?.ventasRecientes as Row[] | undefined) ?? []} /><Recent title="Compras recientes" rows={(data?.comprasRecientes as Row[] | undefined) ?? []} /><Recent title="Movimientos recientes" rows={(data?.movimientosRecientes as Row[] | undefined) ?? []} /></div>
  </>;
}
function Loading() { return <div className="panel"><p className="muted">Cargando datos...</p></div>; }
function ErrorState({ message }: { message: string }) { return <div className="error">{message}</div>; }
function Recent({ title, rows }: { title: string; rows: Row[] }) { return <article className="panel recent-panel"><div className="panel-title"><div><span className="panel-kicker">REGISTROS</span><h3>{title}</h3></div><span className="record-count">{rows.length} registros</span></div>{rows.length === 0 ? <div className="empty-state"><span className="empty-icon">↗</span><p>No hay registros recientes.</p><small>La actividad aparecerá aquí cuando registres operaciones.</small></div> : <div className="recent-list">{rows.map((row, index) => <div className="recent-row" key={String(row.id ?? index)}><span>{String(row.productName ?? row.customerName ?? row.supplierName ?? row.type ?? 'Registro')}</span><strong>{typeof row.total === 'number' ? row.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : String(row.quantity ?? '')}</strong></div>)}</div>}</article>; }
function ResourcePage({ resource }: { resource: string }) {
  const config = resources[resource]!;
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (config.searchable && search) params.set('search', search);
  const { data, loading, error } = useResource<{ items: Row[]; meta: Row }>(`${config.endpoint}?${params.toString()}`);
  const items = data?.items ?? [];
  const totalPages = Math.max(1, Number(data?.meta?.totalPages ?? 1));

  function applySearch(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return <>
    <div className="section-heading"><div><p className="eyebrow">MÓDULO</p><h2>{config.label}</h2><p className="muted">{String(data?.meta?.total ?? items.length)} registros disponibles.</p></div><div className="module-actions">{resource === 'products' && can('products.write') && <Link className="primary link-button" to="/products/new">Nuevo producto</Link>}{resource === 'categories' && can('categories.write') && <Link className="primary link-button" to="/categories/new">Nueva categoría</Link>}{!['products', 'categories', 'inventory', 'audit', 'companies'].includes(resource) && can(`${resource}.write`) && <Link className="primary link-button" to={`/${resource}/new`}>Nuevo registro</Link>}{resource === 'inventory' && <>{can('inventory.write') && <Link className="primary link-button" to="/inventory/movements/new">Registrar movimiento</Link>}<Link className="secondary-button" to="/inventory/movements">Ver movimientos</Link></>}</div></div>
    {config.searchable && <form className="search-bar" onSubmit={applySearch}><input aria-label={`Buscar ${config.label.toLowerCase()}`} placeholder="Buscar…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /><button type="submit">Buscar</button></form>}
    {resource === 'inventory' ? <InventoryStockTable items={items} loading={loading} error={error} /> : loading ? <Loading /> : error ? <ErrorState message={error} /> : <div className="panel table-panel">{items.length === 0 ? <p className="muted">No hay registros para mostrar.</p> : <table><thead><tr><th>{resource === 'users' ? 'Usuario' : resource === 'audit' ? 'Acción' : resource === 'branches' ? 'Sucursal / código' : 'Nombre / código'}</th><th>Estado</th><th>{resource === 'users' ? 'Rol' : 'Identificador'}</th></tr></thead><tbody>{items.map((item, index) => { const label = String(item.name ?? item.displayName ?? item.email ?? item.code ?? item.sku ?? item.productName ?? item.customerName ?? item.supplierName ?? item.action ?? '-'); const editable = can(`${resource}.write`) && resource !== 'audit'; return <tr key={String(item.id ?? index)}><td>{editable ? <Link to={`/${resource}/${String(item.id)}`}>{label}</Link> : label}</td><td>{String(item.status ?? (item.isActive === false ? 'Inactivo' : item.isActive === true ? 'Activo' : item.roleName ?? '-'))}</td><td>{resource === 'users' ? String(item.roleName ?? '-') : String(item.id ?? '-')}</td></tr>; })}</tbody></table>}</div>}
    <div className="pagination"><button type="button" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</button><span>Página {page} de {totalPages}</span><button type="button" disabled={loading || page >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</button></div>
  </>;
}
function InventoryStockTable({ items, loading, error }: { items: Row[]; loading: boolean; error: string | null }) {
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  return <div className="panel table-panel">{items.length === 0 ? <p className="muted">No hay existencias registradas todavía. Crea productos y registra una entrada para comenzar.</p> : <table><thead><tr><th>Producto</th><th>Almacén</th><th>Existencia</th><th>Mínimo</th><th>Disponibilidad</th></tr></thead><tbody>{items.map((item, index) => <tr key={String(item.id ?? index)}><td>{String(item.productName ?? item.sku ?? '-')}</td><td>{String(item.warehouseName ?? '-')}</td><td>{String(item.quantity ?? 0)}</td><td>{String(item.minStock ?? 0)}</td><td><span className={`stock-status ${item.availability === 'out_of_stock' ? 'stock-empty' : item.availability === 'low' ? 'stock-low' : 'stock-ok'}`}>{String(item.availability === 'out_of_stock' ? 'Agotado' : item.availability === 'low' ? 'Stock bajo' : 'Disponible')}</span></td></tr>)}</tbody></table>}</div>;
}
function InventoryMovementsPage() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const { data, loading, error } = useResource<{ items: Row[]; meta: Row }>(`/inventory/movements?page=${page}&limit=20`);
  return <><div className="section-heading"><div><p className="eyebrow">INVENTARIO</p><h2>Movimientos</h2><p className="muted">Historial de entradas, salidas, ajustes, traslados y devoluciones.</p></div>{can('inventory.write') && <Link className="primary link-button" to="/inventory/movements/new">Registrar movimiento</Link>}</div>{loading ? <Loading /> : error ? <ErrorState message={error} /> : <div className="panel table-panel">{!data?.items?.length ? <p className="muted">Todavía no hay movimientos. Registra una entrada para inicializar existencias.</p> : <table><thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Almacén</th><th>Cantidad</th><th>Referencia</th><th>Responsable</th></tr></thead><tbody>{data.items.map((item, index) => <tr key={String(item.id ?? index)}><td>{item.createdAt ? new Date(String(item.createdAt)).toLocaleString('es-MX') : '-'}</td><td>{String(item.type)}</td><td>{String(item.productName ?? '-')}</td><td>{String(item.warehouseName ?? '-')}</td><td>{String(item.quantity ?? '-')}</td><td>{String(item.documentRef ?? item.reason ?? '-')}</td><td>{String(item.userName ?? '-')}</td></tr>)}</tbody></table>}</div>}<div className="pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><span>Página {page} · {String(data?.meta?.total ?? 0)} movimientos</span><button disabled={loading || page >= Number(data?.meta?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div></>;
}
function AuditPage() {
  const [page, setPage] = useState(1); const [filters, setFilters] = useState({ action: '', resource: '', result: '' }); const [applied, setApplied] = useState(filters);
  const query = new URLSearchParams({ page: String(page), limit: '20' }); Object.entries(applied).forEach(([key, value]) => { if (value) query.set(key, value); });
  const { data, loading, error } = useResource<{ items: Row[]; meta: Row }>(`/audit-logs?${query}`);
  return <><div className="section-heading"><div><p className="eyebrow">ADMINISTRACIÓN</p><h2>Auditoría</h2><p className="muted">Actividad registrada para la empresa autenticada.</p></div></div><form className="search-bar" onSubmit={(event) => { event.preventDefault(); setPage(1); setApplied(filters); }}><input placeholder="Acción" value={filters.action} onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))} /><input placeholder="Recurso" value={filters.resource} onChange={(event) => setFilters((current) => ({ ...current, resource: event.target.value }))} /><select aria-label="Resultado" value={filters.result} onChange={(event) => setFilters((current) => ({ ...current, result: event.target.value }))}><option value="">Todos los resultados</option><option value="success">Correcto</option><option value="failure">Fallido</option></select><button type="submit">Filtrar</button></form>{loading ? <Loading /> : error ? <ErrorState message={error} /> : <div className="panel table-panel">{!data?.items?.length ? <p className="muted">No hay eventos para estos filtros.</p> : <table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Recurso</th><th>Resultado</th><th>IP</th><th>Detalle</th></tr></thead><tbody>{data.items.map((event) => <tr key={String(event.id)}><td>{event.createdAt ? new Date(String(event.createdAt)).toLocaleString('es-MX') : '—'}</td><td>{String(event.userName ?? '—')}</td><td>{String(event.action)}</td><td>{String(event.resource)} · {String(event.resourceId ?? '')}</td><td>{String(event.result)}</td><td>{String(event.ip ?? '—')}</td><td><Link to={`/audit/${String(event.id)}`}>Ver</Link></td></tr>)}</tbody></table>}</div>}<div className="pagination"><button disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</button><span>Página {page} de {String(data?.meta?.totalPages ?? 1)}</span><button disabled={loading || page >= Number(data?.meta?.totalPages ?? 1)} onClick={() => setPage((current) => current + 1)}>Siguiente</button></div></>;
}
function AuditDetailPage() {
  const { id } = useParams(); const [item, setItem] = useState<Row | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; apiRequest<Row>(`/audit-logs/${id}`).then((entry) => { if (active) setItem(entry); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el evento'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [id]);
  if (loading) return <Loading />; if (!item) return <ErrorState message={error || 'Evento no encontrado'} />;
  return <div className="panel"><p className="eyebrow">AUDITORÍA</p><h2>{String(item.action)}</h2><dl className="audit-detail">{[['Usuario', item.userName], ['Recurso', item.resource], ['ID del recurso', item.resourceId], ['Fecha', item.createdAt ? new Date(String(item.createdAt)).toLocaleString('es-MX') : null], ['IP', item.ip], ['Resultado', item.result], ['Navegador', item.userAgent]].map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{String(value ?? '—')}</dd></div>)}</dl><h3>Metadatos</h3><pre className="audit-metadata">{JSON.stringify(item.metadata ?? {}, null, 2)}</pre><Link className="secondary-button" to="/audit">Volver a auditoría</Link></div>;
}
function InventoryMovementFormPage() {
  const navigate = useNavigate(); const { can } = useAuth();
  const [products, setProducts] = useState<Row[]>([]); const [warehouses, setWarehouses] = useState<Row[]>([]);
  const [type, setType] = useState('IN'); const [productId, setProductId] = useState(''); const [warehouseId, setWarehouseId] = useState(''); const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('1'); const [reason, setReason] = useState(''); const [documentRef, setDocumentRef] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { let active = true; Promise.all([apiRequest<{ items: Row[] }>('/products?limit=100&status=active'), apiRequest<{ items: Row[] }>('/warehouses?limit=100&status=active')]).then(([p, w]) => { if (active) { setProducts(p.items ?? []); setWarehouses(w.items ?? []); } }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron cargar productos y almacenes'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await apiRequest('/inventory/movements', { method: 'POST', body: JSON.stringify({ type, productId, warehouseId, ...(type === 'TRANSFER' ? { toWarehouseId } : {}), quantity: Number(quantity), reason: reason.trim() || undefined, documentRef: documentRef.trim() || undefined }) }); navigate('/inventory/movements'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo registrar el movimiento'); } finally { setSaving(false); } }
  if (!can('inventory.write')) return <ErrorState message="No tienes permiso para registrar movimientos." />;
  if (loading) return <Loading />;
  const select = (label: string, value: string, update: (next: string) => void, rows: Row[]) => <label>{label}<select required value={value} onChange={(event) => update(event.target.value)}><option value="">Selecciona…</option>{rows.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name ?? row.sku ?? row.id)}</option>)}</select></label>;
  return <div className="panel"><p className="eyebrow">INVENTARIO</p><h2>Registrar movimiento</h2><p className="muted">Cada movimiento actualiza existencias y queda en el historial.</p>{error && <ErrorState message={error} />}<form className="product-form" onSubmit={(event) => void submit(event)}><label>Tipo<select value={type} onChange={(event) => setType(event.target.value)}><option value="IN">Entrada</option><option value="OUT">Salida</option>{can('inventory.adjust') && <option value="ADJUSTMENT">Ajuste (existencia final)</option>}{can('inventory.transfer') && <option value="TRANSFER">Traslado</option>}<option value="RETURN">Devolución</option></select></label>{select('Producto', productId, setProductId, products)}{select(type === 'TRANSFER' ? 'Almacén de origen' : 'Almacén', warehouseId, setWarehouseId, warehouses)}{type === 'TRANSFER' && select('Almacén de destino', toWarehouseId, setToWarehouseId, warehouses.filter((row) => String(row.id) !== warehouseId))}<label>{type === 'ADJUSTMENT' ? 'Existencia final' : 'Cantidad'}<input type="number" min={type === 'ADJUSTMENT' ? '0' : '1'} step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>Motivo<input maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} /></label><label>Referencia de documento<input maxLength={60} value={documentRef} onChange={(event) => setDocumentRef(event.target.value)} /></label><div className="form-actions"><Link className="secondary-button" to="/inventory/movements">Cancelar</Link><button className="primary" disabled={saving || !products.length || !warehouses.length || (type === 'TRANSFER' && (!can('inventory.transfer') || !toWarehouseId)) || (type === 'ADJUSTMENT' && !can('inventory.adjust'))}>{saving ? 'Registrando…' : 'Guardar movimiento'}</button></div></form></div>;
}
type ProductTaxDraft = { name: string; rate: number };
type ProductDraft = {
  code: string; sku: string; name: string; description: string; categoryId: string;
  purchasePrice: string; salePrice: string; unit: string; barcode: string; image: string;
  isActive: boolean; taxes: ProductTaxDraft[];
};
const EMPTY_PRODUCT: ProductDraft = {
  code: '', sku: '', name: '', description: '', categoryId: '', purchasePrice: '0',
  salePrice: '0', unit: 'pza', barcode: '', image: '', isActive: true, taxes: [],
};

function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [form, setForm] = useState<ProductDraft>(EMPTY_PRODUCT);
  const [categories, setCategories] = useState<Row[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest<{ items: Row[] }>('/categories?limit=100')
      .then((result) => { if (active) setCategories(result.items ?? []); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las categorías'); });
    if (id) {
      apiRequest<Row>(`/products/${id}`)
        .then((product) => {
          if (!active) return;
          const taxes = Array.isArray(product.taxes) ? product.taxes as ProductTaxDraft[] : [];
          setForm({
            code: String(product.code ?? ''), sku: String(product.sku ?? ''), name: String(product.name ?? ''),
            description: String(product.description ?? ''), categoryId: String(product.categoryId ?? ''),
            purchasePrice: String(product.purchasePrice ?? 0), salePrice: String(product.salePrice ?? 0),
            unit: String(product.unit ?? 'pza'), barcode: String(product.barcode ?? ''), image: String(product.image ?? ''),
            isActive: product.isActive !== false, taxes,
          });
        })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el producto'); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [id]);

  function update<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const body = {
      code: form.code.trim() || undefined,
      sku: form.sku,
      name: form.name,
      description: form.description.trim() || undefined,
      categoryId: form.categoryId,
      purchasePrice: Number(form.purchasePrice),
      salePrice: Number(form.salePrice),
      taxes: form.taxes,
      unit: form.unit,
      barcode: form.barcode.trim() || undefined,
      image: form.image.trim() || undefined,
      isActive: form.isActive,
    };
    try {
      if (id) await apiRequest(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await apiRequest('/products', { method: 'POST', body: JSON.stringify(body) });
      navigate('/products');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar el producto');
    } finally {
      setSaving(false);
    }
  }

  if (!can('products.write')) return <ErrorState message="No tienes permiso para editar productos." />;
  if (loading) return <Loading />;
  const field = (label: string, key: 'code' | 'sku' | 'name' | 'purchasePrice' | 'salePrice' | 'unit' | 'barcode' | 'image', props: Record<string, string> = {}) => (
    <label>{label}<input {...props} value={form[key]} onChange={(event) => update(key, event.target.value)} /></label>
  );
  return <div className="panel">
    <p className="eyebrow">CATÁLOGO</p><h2>{id ? 'Editar producto' : 'Nuevo producto'}</h2>
    {error && <ErrorState message={error} />}
    <form className="product-form" onSubmit={(event) => void submit(event)}>
      {field('Nombre', 'name', { required: 'true', minLength: '2', maxLength: '120' })}
      {field('SKU', 'sku', { required: 'true', maxLength: '40' })}
      <label>Categoría<select required value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)}><option value="">Selecciona una categoría</option>{categories.map((category) => <option key={String(category.id)} value={String(category.id)}>{String(category.name)}</option>)}</select></label>
      {field('Precio de compra', 'purchasePrice', { type: 'number', min: '0', step: '0.01', required: 'true' })}
      {field('Precio de venta', 'salePrice', { type: 'number', min: '0', step: '0.01', required: 'true' })}
      {field('Unidad', 'unit', { required: 'true', maxLength: '20' })}
      {field('Código interno', 'code', { maxLength: '60' })}
      {field('Código de barras', 'barcode', { maxLength: '60' })}
      {field('URL de imagen', 'image', { type: 'url', maxLength: '500' })}
      <label>Descripción<textarea value={form.description} maxLength={1000} onChange={(event) => update('description', event.target.value)} /></label>
      <section className="sale-lines"><div className="panel-title"><h3>Impuestos del producto</h3><button type="button" onClick={() => update('taxes', [...form.taxes, { name: '', rate: 0 }])}>+ Agregar impuesto</button></div>{!form.taxes.length && <small className="muted">Este producto no tiene impuestos adicionales.</small>}{form.taxes.map((tax, index) => <div className="sale-line tax-line" key={index}><label>Nombre<input required maxLength={60} value={tax.name} onChange={(event) => update('taxes', form.taxes.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /></label><label>Tasa (%)<input type="number" required min="0" max="100" step="0.01" value={tax.rate} onChange={(event) => update('taxes', form.taxes.map((item, itemIndex) => itemIndex === index ? { ...item, rate: Number(event.target.value) } : item))} /></label><button type="button" onClick={() => update('taxes', form.taxes.filter((_, itemIndex) => itemIndex !== index))}>Quitar</button></div>)}</section>
      <label className="checkbox-label"><input type="checkbox" checked={form.isActive} onChange={(event) => update('isActive', event.target.checked)} />Producto activo</label>
      <div className="form-actions"><button type="button" onClick={() => navigate('/products')}>Cancelar</button><button className="primary" disabled={saving || categories.length === 0}>{saving ? 'Guardando…' : 'Guardar producto'}</button></div>
    </form>
  </div>;
}

function CategoryFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let active = true;
    apiRequest<Row>(`/categories/${id}`)
      .then((category) => {
        if (!active) return;
        setName(String(category.name ?? ''));
        setDescription(String(category.description ?? ''));
        setIsActive(category.isActive !== false);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar la categoría'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = id ? { name, description, isActive } : { name, description };
      await apiRequest(id ? `/categories/${id}` : '/categories', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      navigate('/categories');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar la categoría');
    } finally {
      setSaving(false);
    }
  }

  if (!can('categories.write')) return <ErrorState message="No tienes permiso para editar categorías." />;
  if (loading) return <Loading />;
  return <div className="panel"><p className="eyebrow">CATÁLOGO</p><h2>{id ? 'Editar categoría' : 'Nueva categoría'}</h2>{error && <ErrorState message={error} />}<form className="product-form" onSubmit={(event) => void submit(event)}><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required /></label><label>Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></label>{id && <label className="checkbox-label"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />Categoría activa</label>}<div className="form-actions"><button type="button" onClick={() => navigate('/categories')}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar categoría'}</button></div></form></div>;
}

function SaleCreatePage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [customers, setCustomers] = useState<Row[]>([]);
  const [warehouses, setWarehouses] = useState<Row[]>([]);
  const [products, setProducts] = useState<Row[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState<Array<{ productId: string; quantity: string; discount: string }>>([{ productId: '', quantity: '1', discount: '0' }]);
  const [barcode, setBarcode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<{ items: Row[] }>('/customers?limit=100'),
      apiRequest<{ items: Row[] }>('/warehouses?limit=100'),
      apiRequest<{ items: Row[] }>('/products?limit=100&status=active'),
    ]).then(([customerResult, warehouseResult, productResult]) => {
      if (!active) return;
      setCustomers(customerResult.items ?? []); setWarehouses(warehouseResult.items ?? []); setProducts(productResult.items ?? []);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los datos'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await apiRequest('/sales', { method: 'POST', body: JSON.stringify({ customerId, warehouseId, notes: notes.trim() || undefined, items: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), discount: Number(line.discount) })) }) });
      navigate('/sales');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo crear la venta'); }
    finally { setSaving(false); }
  }
  async function addScannedProduct(event?: React.FormEvent | React.KeyboardEvent<HTMLInputElement>) {
    event?.preventDefault();
    const scannedCode = barcode.trim();
    if (!scannedCode || scanning) return;
    setScanning(true); setError('');
    try {
      const result = await apiRequest<{ items: Row[] }>(`/products?status=active&limit=100&search=${encodeURIComponent(scannedCode)}`);
      const product = (result.items ?? []).find((item) => [item.barcode, item.sku, item.code].some((value) => String(value ?? '').toLocaleLowerCase() === scannedCode.toLocaleLowerCase()));
      if (!product) { setError(`No se encontró un producto activo con el código “${scannedCode}”.`); return; }
      const productId = String(product.id);
      setLines((current) => {
        const existingIndex = current.findIndex((line) => line.productId === productId);
        if (existingIndex >= 0) return current.map((line, index) => index === existingIndex ? { ...line, quantity: String(Number(line.quantity || 0) + 1) } : line);
        const emptyIndex = current.findIndex((line) => !line.productId);
        if (emptyIndex >= 0) return current.map((line, index) => index === emptyIndex ? { ...line, productId, quantity: '1' } : line);
        return [...current, { productId, quantity: '1', discount: '0' }];
      });
      setProducts((current) => current.some((item) => String(item.id) === productId) ? current : [...current, product]);
      setBarcode('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo buscar el código de barras'); }
    finally { setScanning(false); }
  }
  if (!can('sales.write')) return <ErrorState message="No tienes permiso para crear ventas." />;
  if (loading) return <Loading />;
  const estimate = lines.reduce((total, line) => {
    const product = products.find((item) => String(item.id) === line.productId);
    if (!product) return total;
    const taxable = Number(product.salePrice ?? 0) * Number(line.quantity) * (1 - Number(line.discount) / 100);
    const taxes = ((product.taxes as Array<{ rate: number }> | undefined) ?? []).reduce((sum, tax) => sum + taxable * (Number(tax.rate) / 100), 0);
    return total + taxable + taxes;
  }, 0);
  const select = (label: string, value: string, update: (next: string) => void, rows: Row[]) => <label>{label}<select required value={value} onChange={(event) => update(event.target.value)}><option value="">Selecciona…</option>{rows.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name ?? row.sku ?? row.id)}</option>)}</select></label>;
  return <div className="panel"><p className="eyebrow">VENTAS</p><h2>Nueva venta</h2><p className="muted">Agrega productos con el lector de código de barras o manualmente. El servidor calcula los totales y descuenta el stock al confirmar.</p>{error && <ErrorState message={error} />}<form className="product-form" onSubmit={(event) => void submit(event)}>{select('Cliente', customerId, setCustomerId, customers)}{select('Almacén', warehouseId, setWarehouseId, warehouses)}<div className="sale-lines"><div className="panel-title"><h3>Productos</h3><button type="button" onClick={() => setLines((items) => [...items, { productId: '', quantity: '1', discount: '0' }])}>+ Agregar producto</button></div><div className="barcode-entry"><label htmlFor="sale-barcode">Escanear código de barras</label><div><input id="sale-barcode" autoComplete="off" placeholder="Escanea o escribe el código y presiona Enter" value={barcode} onChange={(event) => setBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void addScannedProduct(event); }} /><button type="button" disabled={scanning || !barcode.trim()} onClick={() => void addScannedProduct()}>{scanning ? 'Buscando…' : 'Agregar'}</button></div><small>Los lectores USB que escriben como teclado funcionan aquí. Cada lectura agrega una unidad.</small></div>{lines.map((line, index) => <div className="sale-line" key={index}><label>Producto<select required value={line.productId} onChange={(event) => setLines((items) => items.map((item, i) => i === index ? { ...item, productId: event.target.value } : item))}><option value="">Selecciona…</option>{products.filter((product) => String(product.id) === line.productId || !lines.some((item, i) => i !== index && item.productId === String(product.id))).map((product) => <option key={String(product.id)} value={String(product.id)}>{String(product.sku ?? '')} · {String(product.name)} · {Number(product.salePrice ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</option>)}</select></label><label>Cantidad<input type="number" min="1" step="1" required value={line.quantity} onChange={(event) => setLines((items) => items.map((item, i) => i === index ? { ...item, quantity: event.target.value } : item))} /></label><label>Descuento %<input type="number" min="0" max="100" step="0.01" value={line.discount} onChange={(event) => setLines((items) => items.map((item, i) => i === index ? { ...item, discount: event.target.value } : item))} /></label><button type="button" disabled={lines.length === 1} onClick={() => setLines((items) => items.filter((_, i) => i !== index))}>Quitar</button></div>)}</div><label>Notas<textarea maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="sale-estimate"><span>Total estimado</span><strong>{estimate.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</strong><small>El total definitivo lo calcula la API.</small></div><div className="form-actions"><Link className="secondary-button" to="/sales">Cancelar</Link><button className="primary" disabled={saving || !customers.length || !warehouses.length || !products.length || lines.some((line) => !line.productId)}>{saving ? 'Guardando…' : 'Crear venta pendiente'}</button></div></form></div>;
}

function SalesPage() {
  const { can } = useAuth();
  const [refresh, setRefresh] = useState(0); const [page, setPage] = useState(1); const [searchInput, setSearchInput] = useState(''); const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const salesQuery = new URLSearchParams({ page: String(page), limit: '20', refresh: String(refresh) }); if (search) salesQuery.set('search', search);
  const { data, loading } = useResource<{ items: Row[]; meta: Row }>(`/sales?${salesQuery}`);
  async function transition(id: string, action: 'confirm' | 'cancel' | 'return') {
    setError('');
    try { await apiRequest(`/sales/${id}/${action}`, { method: 'POST' }); setRefresh((value) => value + 1); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar la venta'); }
  }
  return <><div className="section-heading"><div><p className="eyebrow">MÓDULO</p><h2>Ventas</h2><p className="muted">{String(data?.meta?.total ?? 0)} registros disponibles.</p></div>{can('sales.write') && <Link className="primary link-button" to="/sales/new">Nueva venta</Link>}</div><form className="search-bar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}><input placeholder="Buscar por folio o cliente…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /><button>Buscar</button></form>{error && <ErrorState message={error} />}{loading ? <Loading /> : <div className="panel table-panel">{!data?.items?.length ? <p className="muted">No hay ventas para mostrar.</p> : <table><thead><tr><th>Cliente</th><th>Estado</th><th>Total</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>{data.items.map((sale) => <tr key={String(sale.id)}><td><Link to={`/sales/${String(sale.id)}`}>{String(sale.customerName ?? 'Ver detalle')}</Link></td><td>{String(sale.status)}</td><td>{typeof sale.total === 'number' ? sale.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '-'}</td><td>{sale.saleDate ? new Date(String(sale.saleDate)).toLocaleDateString('es-MX') : '-'}</td><td>{sale.status === 'pending' && can('sales.confirm') && <button type="button" onClick={() => void transition(String(sale.id), 'confirm')}>Confirmar</button>} {['pending', 'confirmed'].includes(String(sale.status)) && can('sales.cancel') && <button type="button" onClick={() => window.confirm('¿Cancelar esta venta? Si ya estaba confirmada, se repondrá el inventario.') && void transition(String(sale.id), 'cancel')}>Cancelar</button>} {sale.status === 'confirmed' && can('sales.return') && <button type="button" onClick={() => window.confirm('¿Registrar la devolución completa de esta venta y reponer el inventario?') && void transition(String(sale.id), 'return')}>Devolver</button>}</td></tr>)}</tbody></table>}</div>}<div className="pagination"><button disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</button><span>Página {page} de {String(data?.meta?.totalPages ?? 1)}</span><button disabled={loading || page >= Number(data?.meta?.totalPages ?? 1)} onClick={() => setPage((current) => current + 1)}>Siguiente</button></div></>;
}

function SaleDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [sale, setSale] = useState<Row | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; apiRequest<Row>(`/sales/${id}`).then((item) => { if (active) setSale(item); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar la venta'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [id]);
  async function transition(action: 'confirm' | 'cancel' | 'return') { if (!id) return; setError(''); try { setSale(await apiRequest<Row>(`/sales/${id}/${action}`, { method: 'POST' })); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar la venta'); } }
  if (loading) return <Loading />; if (!sale) return <ErrorState message={error || 'Venta no encontrada'} />;
  const items = (sale.items as Row[]) ?? []; const history = (sale.history as Row[]) ?? [];
  return <div className="panel"><p className="eyebrow">VENTA</p><h2>{String(sale.customerName ?? 'Detalle')}</h2><p className="muted">{String(sale.status)} · {sale.saleDate ? new Date(String(sale.saleDate)).toLocaleString('es-MX') : ''} · {String(sale.warehouseName ?? '')}</p>{error && <ErrorState message={error} />}<div className="table-panel"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Descuento</th><th>Total</th></tr></thead><tbody>{items.map((item, index) => <tr key={String(item.productId ?? index)}><td>{String(item.productName ?? '-')}</td><td>{String(item.quantity ?? 0)}</td><td>{Number(item.unitPrice ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td><td>{String(item.discount ?? 0)}%</td><td>{Number(item.total ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td></tr>)}</tbody></table></div><h3>Total: {Number(sale.total ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</h3><h3>Historial</h3><ul>{history.map((event, index) => <li key={index}>{String(event.action)} · {String(event.userName ?? '')} · {event.at ? new Date(String(event.at)).toLocaleString('es-MX') : ''}</li>)}</ul><div className="form-actions"><Link className="secondary-button" to="/sales">Volver a ventas</Link>{sale.status === 'pending' && can('sales.confirm') && <button onClick={() => void transition('confirm')}>Confirmar</button>}{['pending', 'confirmed'].includes(String(sale.status)) && can('sales.cancel') && <button onClick={() => window.confirm('¿Cancelar esta venta? Si ya estaba confirmada, se repondrá el inventario.') && void transition('cancel')}>Cancelar</button>}{sale.status === 'confirmed' && can('sales.return') && <button onClick={() => window.confirm('¿Registrar devolución completa y reponer el inventario?') && void transition('return')}>Devolver venta</button>}</div></div>;
}

function PurchaseCreatePage() {
  const navigate = useNavigate(); const { can } = useAuth();
  const [suppliers, setSuppliers] = useState<Row[]>([]); const [warehouses, setWarehouses] = useState<Row[]>([]); const [products, setProducts] = useState<Row[]>([]);
  const [supplierId, setSupplierId] = useState(''); const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState<Array<{ productId: string; quantity: string; unitCost: string; discount: string; taxes: Array<{ name: string; rate: number }> }>>([{ productId: '', quantity: '1', unitCost: '', discount: '0', taxes: [] }]); const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([apiRequest<{ items: Row[] }>('/suppliers?limit=100'), apiRequest<{ items: Row[] }>('/warehouses?limit=100'), apiRequest<{ items: Row[] }>('/products?limit=100&status=active')])
      .then(([s, w, p]) => { if (active) { setSuppliers(s.items ?? []); setWarehouses(w.items ?? []); setProducts(p.items ?? []); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los datos'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await apiRequest('/purchases', { method: 'POST', body: JSON.stringify({ supplierId, warehouseId, notes: notes.trim() || undefined, items: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitCost: Number(line.unitCost), discount: Number(line.discount), taxes: line.taxes })) }) }); navigate('/purchases'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo crear la compra'); } finally { setSaving(false); } }
  if (!can('purchases.write')) return <ErrorState message="No tienes permiso para crear compras." />; if (loading) return <Loading />;
  const select = (label: string, value: string, update: (next: string) => void, rows: Row[]) => <label>{label}<select required value={value} onChange={(event) => update(event.target.value)}><option value="">Selecciona…</option>{rows.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name ?? row.sku ?? row.id)}</option>)}</select></label>;
  const estimatedTotal = lines.reduce((sum, line) => { const taxable = Number(line.quantity || 0) * Number(line.unitCost || 0) * (1 - Number(line.discount || 0) / 100); return sum + taxable + line.taxes.reduce((taxSum, tax) => taxSum + taxable * tax.rate / 100, 0); }, 0);
  return <div className="panel"><p className="eyebrow">COMPRAS</p><h2>Nueva compra</h2><p className="muted">La compra inicia pendiente. Confírmala antes de registrar una recepción. Los costos e impuestos pueden ajustarse según la factura del proveedor.</p>{error && <ErrorState message={error} />}<form className="product-form" onSubmit={(event) => void submit(event)}>{select('Proveedor', supplierId, setSupplierId, suppliers)}{select('Almacén', warehouseId, setWarehouseId, warehouses)}<div className="sale-lines"><div className="panel-title"><h3>Productos</h3><button type="button" onClick={() => setLines((items) => [...items, { productId: '', quantity: '1', unitCost: '', discount: '0', taxes: [] }])}>+ Agregar producto</button></div>{lines.map((line, index) => <div className="sale-line" key={index}><label>Producto<select required value={line.productId} onChange={(event) => { const selected = products.find((product) => String(product.id) === event.target.value); setLines((items) => items.map((item, i) => i === index ? { ...item, productId: event.target.value, unitCost: selected ? String(selected.purchasePrice ?? 0) : '', taxes: selected && Array.isArray(selected.taxes) ? (selected.taxes as Array<{ name: string; rate: number }>).map((tax) => ({ name: tax.name, rate: Number(tax.rate) })) : [] } : item)); }}><option value="">Selecciona…</option>{products.filter((product) => String(product.id) === line.productId || !lines.some((item, i) => i !== index && item.productId === String(product.id))).map((product) => <option key={String(product.id)} value={String(product.id)}>{String(product.sku ?? '')} · {String(product.name)}</option>)}</select></label><label>Cantidad<input type="number" min="1" step="1" required value={line.quantity} onChange={(event) => setLines((items) => items.map((item, i) => i === index ? { ...item, quantity: event.target.value } : item))} /></label><label>Costo unitario<input type="number" min="0" step="0.01" required value={line.unitCost} onChange={(event) => setLines((items) => items.map((item, i) => i === index ? { ...item, unitCost: event.target.value } : item))} /></label><label>Descuento %<input type="number" min="0" max="100" step="0.01" value={line.discount} onChange={(event) => setLines((items) => items.map((item, i) => i === index ? { ...item, discount: event.target.value } : item))} /></label><button type="button" disabled={lines.length === 1} onClick={() => setLines((items) => items.filter((_, i) => i !== index))}>Quitar</button><div className="tax-list"><div className="panel-title"><strong>Impuestos</strong><button type="button" onClick={() => setLines((items) => items.map((item, i) => i === index ? { ...item, taxes: [...item.taxes, { name: 'IVA', rate: 0 }] } : item))}>+ Añadir</button></div>{line.taxes.map((tax, taxIndex) => <div className="tax-row" key={taxIndex}><input aria-label="Nombre del impuesto" required maxLength={80} value={tax.name} onChange={(event) => setLines((items) => items.map((item, i) => i === index ? { ...item, taxes: item.taxes.map((currentTax, j) => j === taxIndex ? { ...currentTax, name: event.target.value } : currentTax) } : item))} /><input aria-label="Tasa del impuesto (%)" type="number" min="0" max="100" step="0.01" value={tax.rate} onChange={(event) => setLines((items) => items.map((item, i) => i === index ? { ...item, taxes: item.taxes.map((currentTax, j) => j === taxIndex ? { ...currentTax, rate: Number(event.target.value) } : currentTax) } : item))} /><button type="button" onClick={() => setLines((items) => items.map((item, i) => i === index ? { ...item, taxes: item.taxes.filter((_, j) => j !== taxIndex) } : item))}>Quitar</button></div>)}</div></div>)}</div><label>Notas<textarea maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="sale-estimate"><span>Total estimado</span><strong>{estimatedTotal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</strong><small>El total definitivo lo calcula la API.</small></div><div className="form-actions"><Link className="secondary-button" to="/purchases">Cancelar</Link><button className="primary" disabled={saving || !suppliers.length || !warehouses.length || !products.length || lines.some((line) => !line.productId || !line.unitCost)}>{saving ? 'Guardando…' : 'Crear compra pendiente'}</button></div></form></div>;
}

function PurchaseReceivePage() {
  const { id } = useParams(); const navigate = useNavigate(); const { can } = useAuth();
  const [purchase, setPurchase] = useState<Row | null>(null); const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [idempotencyKey] = useState(() => crypto.randomUUID().replaceAll('-', '')); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { let active = true; apiRequest<Row>(`/purchases/${id}`).then((result) => { if (active) setPurchase(result); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar la compra'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [id]);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!purchase) return; const items = ((purchase.items as Row[]) ?? []).map((item) => ({ productId: String(item.productId), quantity: Number(quantities[String(item.productId)] ?? 0) })).filter((item) => item.quantity > 0); if (!items.length) { setError('Indica al menos una cantidad para recibir.'); return; } setSaving(true); setError(''); try { await apiRequest(`/purchases/${id}/receive`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ items }) }); navigate('/purchases'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo registrar la recepción'); } finally { setSaving(false); } }
  if (!can('purchases.receive')) return <ErrorState message="No tienes permiso para recibir compras." />; if (loading) return <Loading />; if (!purchase) return <ErrorState message={error || 'Compra no encontrada'} />;
  const lines = (purchase.items as Row[]) ?? [];
  return <div className="panel"><p className="eyebrow">RECEPCIÓN</p><h2>Recibir compra</h2><p className="muted">{String(purchase.supplierName)} · {String(purchase.warehouseName)} · {String(purchase.status)}</p>{error && <ErrorState message={error} />}<form className="product-form" onSubmit={(event) => void submit(event)}>{lines.map((item) => { const remaining = Number(item.quantity) - Number(item.receivedQuantity ?? 0); return <label key={String(item.productId)}>{String(item.productName)} · pendiente {remaining}<input aria-label={`Cantidad recibida de ${String(item.productName)}`} type="number" min="0" max={remaining} step="1" value={quantities[String(item.productId)] ?? '0'} disabled={remaining <= 0} onChange={(event) => setQuantities((current) => ({ ...current, [String(item.productId)]: event.target.value }))} /></label>; })}<div className="form-actions"><button type="button" onClick={() => navigate('/purchases')}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Registrando…' : 'Registrar recepción'}</button></div></form></div>;
}

function PurchasesPage() {
  const { can } = useAuth(); const [refresh, setRefresh] = useState(0); const [page, setPage] = useState(1); const [status, setStatus] = useState(''); const [error, setError] = useState('');
  const purchasesQuery = new URLSearchParams({ page: String(page), limit: '20', refresh: String(refresh) }); if (status) purchasesQuery.set('status', status);
  const { data, loading } = useResource<{ items: Row[]; meta: Row }>(`/purchases?${purchasesQuery}`);
  async function transition(id: string, action: 'confirm' | 'cancel' | 'return') { setError(''); try { await apiRequest(`/purchases/${id}/${action}`, { method: 'POST' }); setRefresh((value) => value + 1); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar la compra'); } }
  return <><div className="section-heading"><div><p className="eyebrow">MÓDULO</p><h2>Compras</h2><p className="muted">{String(data?.meta?.total ?? 0)} registros disponibles.</p></div>{can('purchases.write') && <Link className="primary link-button" to="/purchases/new">Nueva compra</Link>}</div><label className="status-filter">Estado<select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}><option value="">Todos</option>{['pending', 'confirmed', 'partially_received', 'received', 'cancelled', 'returned'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>{error && <ErrorState message={error} />}{loading ? <Loading /> : <div className="panel table-panel">{!data?.items?.length ? <p className="muted">No hay compras para mostrar.</p> : <table><thead><tr><th>Proveedor</th><th>Estado</th><th>Total</th><th>Acciones</th></tr></thead><tbody>{data.items.map((purchase) => <tr key={String(purchase.id)}><td><Link to={`/purchases/${String(purchase.id)}`}>{String(purchase.supplierName ?? 'Ver detalle')}</Link></td><td>{String(purchase.status)}</td><td>{typeof purchase.total === 'number' ? purchase.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '-'}</td><td>{purchase.status === 'pending' && can('purchases.confirm') && <button type="button" onClick={() => void transition(String(purchase.id), 'confirm')}>Confirmar</button>} {['pending', 'confirmed'].includes(String(purchase.status)) && can('purchases.cancel') && <button type="button" onClick={() => window.confirm('¿Cancelar esta compra?') && void transition(String(purchase.id), 'cancel')}>Cancelar</button>} {['confirmed', 'partially_received'].includes(String(purchase.status)) && can('purchases.receive') && <Link to={`/purchases/${String(purchase.id)}/receive`}>Recibir</Link>} {['partially_received', 'received'].includes(String(purchase.status)) && can('purchases.receive') && <button type="button" onClick={() => window.confirm('¿Registrar devolución completa de la mercancía recibida?') && void transition(String(purchase.id), 'return')}>Devolver</button>}</td></tr>)}</tbody></table>}</div>}<div className="pagination"><button disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</button><span>Página {page} de {String(data?.meta?.totalPages ?? 1)}</span><button disabled={loading || page >= Number(data?.meta?.totalPages ?? 1)} onClick={() => setPage((current) => current + 1)}>Siguiente</button></div></>;
}

function PurchaseDetailPage() {
  const { id } = useParams(); const { can } = useAuth(); const [purchase, setPurchase] = useState<Row | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; apiRequest<Row>(`/purchases/${id}`).then((item) => { if (active) setPurchase(item); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar la compra'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [id]);
  async function transition(action: 'confirm' | 'cancel' | 'return') { if (!id) return; setError(''); try { setPurchase(await apiRequest<Row>(`/purchases/${id}/${action}`, { method: 'POST' })); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar la compra'); } }
  if (loading) return <Loading />; if (!purchase) return <ErrorState message={error || 'Compra no encontrada'} />;
  const items = (purchase.items as Row[]) ?? []; const history = (purchase.history as Row[]) ?? [];
  return <div className="panel"><p className="eyebrow">COMPRA</p><h2>{String(purchase.supplierName ?? 'Detalle')}</h2><p className="muted">{String(purchase.status)} · {purchase.purchaseDate ? new Date(String(purchase.purchaseDate)).toLocaleString('es-MX') : ''} · {String(purchase.warehouseName ?? '')}</p>{error && <ErrorState message={error} />}<div className="table-panel"><table><thead><tr><th>Producto</th><th>Solicitado</th><th>Recibido</th><th>Costo unitario</th><th>Total</th></tr></thead><tbody>{items.map((item, index) => <tr key={String(item.productId ?? index)}><td>{String(item.productName ?? '-')}</td><td>{String(item.quantity ?? 0)}</td><td>{String(item.receivedQuantity ?? 0)}</td><td>{Number(item.unitCost ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td><td>{Number(item.total ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</td></tr>)}</tbody></table></div><h3>Total: {Number(purchase.total ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</h3><h3>Historial</h3><ul>{history.map((event, index) => <li key={index}>{String(event.action)} · {String(event.userName ?? '')} · {event.at ? new Date(String(event.at)).toLocaleString('es-MX') : ''}</li>)}</ul><div className="form-actions"><Link className="secondary-button" to="/purchases">Volver a compras</Link>{purchase.status === 'pending' && can('purchases.confirm') && <button onClick={() => void transition('confirm')}>Confirmar</button>}{['pending', 'confirmed'].includes(String(purchase.status)) && can('purchases.cancel') && <button onClick={() => window.confirm('¿Cancelar esta compra?') && void transition('cancel')}>Cancelar</button>}{['confirmed', 'partially_received'].includes(String(purchase.status)) && can('purchases.receive') && <Link to={`/purchases/${id}/receive`}>Registrar recepción</Link>}{['partially_received', 'received'].includes(String(purchase.status)) && can('purchases.receive') && <button onClick={() => window.confirm('¿Registrar devolución completa?') && void transition('return')}>Devolver compra</button>}</div></div>;
}

const reportFilters: Record<string, string[]> = { sales: ['dateFrom', 'dateTo', 'branchId', 'warehouseId', 'productId', 'customerId', 'userId', 'status'], purchases: ['dateFrom', 'dateTo', 'branchId', 'warehouseId', 'productId', 'supplierId', 'userId', 'status'], inventory: ['warehouseId', 'productId'], 'inventory-movements': ['dateFrom', 'dateTo', 'warehouseId', 'productId', 'userId'], products: ['productId', 'categoryId'], customers: ['customerId'], suppliers: ['supplierId'] };

function ReportsPage() {
  const { user, can } = useAuth(); const [error, setError] = useState(''); const [downloading, setDownloading] = useState<string | null>(null);
  const [type, setType] = useState('sales'); const [format, setFormat] = useState<'csv' | 'pdf'>('csv'); const [filters, setFilters] = useState<Record<string, string>>({}); const [options, setOptions] = useState<Record<string, Row[]>>({});
  useEffect(() => { let active = true; const sources: Record<string, string> = { branchId: '/branches?limit=100', warehouseId: '/warehouses?limit=100', productId: '/products?limit=100', categoryId: '/categories?limit=100', customerId: '/customers?limit=100', supplierId: '/suppliers?limit=100', userId: '/users?limit=100' }; Promise.all(Object.entries(sources).map(async ([key, path]) => { try { const data = await apiRequest<{ items: Row[] }>(path); return [key, data.items ?? []] as const; } catch { return [key, []] as const; } })).then((entries) => { if (active) setOptions(Object.fromEntries(entries)); }); return () => { active = false; }; }, []);
  async function download() { setError(''); setDownloading(format); try { const activeFilters = reportFilters[type] ?? []; const entries = activeFilters.flatMap((key): Array<[string, string]> => { const value = filters[key]; if (!value) return []; return [[key, key === 'dateFrom' || key === 'dateTo' ? new Date(`${value}T00:00:00.000Z`).toISOString() : value]]; }); const query = new URLSearchParams(entries); const suffix = query.size ? `?${query.toString()}` : ''; const result = await downloadReport(`/reports/${type}.${format}${suffix}`); const url = URL.createObjectURL(result.blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = result.filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo descargar el reporte'); } finally { setDownloading(null); } }
  const types = [['sales', 'Ventas'], ['purchases', 'Compras'], ['inventory', 'Inventario'], ['inventory-movements', 'Movimientos de inventario'], ['products', 'Productos'], ['customers', 'Clientes'], ['suppliers', 'Proveedores']];
  const labels: Record<string, string> = { dateFrom: 'Desde', dateTo: 'Hasta', branchId: 'Sucursal', warehouseId: 'Almacén', productId: 'Producto', customerId: 'Cliente', supplierId: 'Proveedor', userId: 'Usuario', categoryId: 'Categoría', status: 'Estado' };
  return <div className="panel"><p className="eyebrow">REPORTES</p><h2>Exportaciones</h2><p className="muted">Selecciona reporte, filtros y formato. Los datos corresponden a tu empresa.</p>{error && <p className="error">{error}</p>}<div className="product-form report-filters"><label>Reporte<select value={type} onChange={(event) => setType(event.target.value)}>{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Formato<select value={format} onChange={(event) => setFormat(event.target.value as 'csv' | 'pdf')}><option value="csv">CSV (hoja de cálculo)</option><option value="pdf">PDF</option></select></label>{reportFilters[type]?.map((key) => <label key={key}>{labels[key]}{key === 'dateFrom' || key === 'dateTo' ? <input type="date" value={filters[key] ?? ''} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))} /> : key === 'status' ? <select value={filters[key] ?? ''} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))}><option value="">Todos</option>{['pending', 'confirmed', 'partially_received', 'received', 'cancelled', 'returned'].map((value) => <option key={value} value={value}>{value}</option>)}</select> : key === 'categoryId' ? <input value={filters[key] ?? ''} placeholder="ID de categoría" onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))} /> : <select value={filters[key] ?? ''} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))}><option value="">Todos</option>{(options[key] ?? []).map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name ?? row.email ?? row.sku ?? row.id)}</option>)}</select>}</label>)}</div><div className="form-actions"><button type="button" className="primary" disabled={!can('reports.export') || downloading !== null} onClick={() => void download()}>{downloading ? 'Descargando…' : `Descargar ${format.toUpperCase()}`}</button></div>{!can('reports.export') && <p className="muted">Tu rol no tiene permiso para exportar reportes.</p>}<small className="muted">Usuario: {user?.email}</small></div>;
}
function AppRoutes() { return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /><Route path="/reset-password" element={<ResetPasswordPage />} /><Route element={<Shell />}><Route path="/dashboard" element={<DashboardPage />} /><Route path="/change-password" element={<ChangePasswordPage />} /><Route path="/reports" element={<ReportsPage />} /><Route path="/products/new" element={<ProductFormPage />} /><Route path="/products/:id" element={<ProductFormPage />} /><Route path="/categories/new" element={<CategoryFormPage />} /><Route path="/categories/:id" element={<CategoryFormPage />} /><Route path="/sales/new" element={<SaleCreatePage />} /><Route path="/sales/:id" element={<SaleDetailPage />} /><Route path="/sales" element={<SalesPage />} /><Route path="/purchases/new" element={<PurchaseCreatePage />} /><Route path="/purchases/:id/receive" element={<PurchaseReceivePage />} /><Route path="/purchases/:id" element={<PurchaseDetailPage />} /><Route path="/purchases" element={<PurchasesPage />} /><Route path="/audit/:id" element={<AuditDetailPage />} /><Route path="/audit" element={<AuditPage />} /><Route path="/inventory/movements/new" element={<InventoryMovementFormPage />} /><Route path="/inventory/movements" element={<InventoryMovementsPage />} />{Object.keys(resources).filter((resource) => !['sales', 'purchases', 'audit'].includes(resource)).map((resource) => <Route path={`/${resource}`} element={<ResourcePage resource={resource} />} key={resource} />)}{Object.keys(resources).filter((resource) => !['sales', 'purchases', 'inventory', 'audit', 'products', 'categories'].includes(resource)).map((resource) => <Route path={`/${resource}/:id`} element={<EntityFormPage />} key={`${resource}-detail`} />)}<Route path="/:resource/new" element={<EntityFormPage />} /><Route path="*" element={<Navigate to="/dashboard" replace />} /></Route></Routes>; }
export default function Root() { return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>; }
