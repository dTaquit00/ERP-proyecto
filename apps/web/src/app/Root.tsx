import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth, useResource } from '../auth/AuthProvider';
import { apiRequest, downloadReport } from '../services/api';
import '../ui.css';

type Row = Record<string, unknown>;
const resources: Record<string, { label: string; endpoint: string; permission: string; searchable?: boolean }> = {
  products: { label: 'Productos', endpoint: '/products', permission: 'products.read', searchable: true }, categories: { label: 'Categorías', endpoint: '/categories', permission: 'categories.read', searchable: true }, customers: { label: 'Clientes', endpoint: '/customers', permission: 'customers.read', searchable: true }, suppliers: { label: 'Proveedores', endpoint: '/suppliers', permission: 'suppliers.read', searchable: true }, warehouses: { label: 'Almacenes', endpoint: '/warehouses', permission: 'warehouses.read', searchable: true }, branches: { label: 'Sucursales', endpoint: '/branches', permission: 'branches.read', searchable: true }, sales: { label: 'Ventas', endpoint: '/sales', permission: 'sales.read', searchable: true }, purchases: { label: 'Compras', endpoint: '/purchases', permission: 'purchases.read' }, inventory: { label: 'Existencias', endpoint: '/inventory/stock', permission: 'inventory.read' }, users: { label: 'Usuarios', endpoint: '/users', permission: 'users.read', searchable: true }, roles: { label: 'Roles', endpoint: '/roles', permission: 'roles.read' }, audit: { label: 'Auditoría', endpoint: '/audit-logs', permission: 'audit.read' },
};

function LoginPage() { const { login } = useAuth(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [companyId, setCompanyId] = useState(''); const [error, setError] = useState(''); const navigate = useNavigate(); async function submit(event: React.FormEvent) { event.preventDefault(); setError(''); try { await login(email, password, companyId || undefined); navigate('/dashboard'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo iniciar sesión'); } } return <main className="login-shell"><form className="login-card" onSubmit={submit}><div className="brand-mark">N</div><p className="eyebrow">NEXUS ERP</p><h1>Tu operación, en foco.</h1><p className="muted">Accede al centro de control de tu empresa.</p><label>Correo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label>Empresa (opcional)<input value={companyId} onChange={(event) => setCompanyId(event.target.value)} placeholder="ID de empresa, si tu correo está en varias" /></label>{error && <p className="error">{error}</p>}<button className="primary">Iniciar sesión</button></form></main>; }

function Shell() { const { user, loading, logout, can } = useAuth(); const location = useLocation(); if (loading) return <div className="loading">Cargando espacio de trabajo...</div>; if (!user) return <Navigate to="/login" replace />; const links = [['/dashboard', 'Dashboard', true], ['/products', 'Productos', can('products.read')], ['/categories', 'Categorías', can('categories.read')], ['/customers', 'Clientes', can('customers.read')], ['/suppliers', 'Proveedores', can('suppliers.read')], ['/warehouses', 'Almacenes', can('warehouses.read')], ['/branches', 'Sucursales', can('branches.read')], ['/inventory', 'Inventario', can('inventory.read')], ['/sales', 'Ventas', can('sales.read')], ['/purchases', 'Compras', can('purchases.read')], ['/reports', 'Reportes', can('reports.read')], ['/users', 'Usuarios', can('users.read')], ['/roles', 'Roles', can('roles.read')], ['/audit', 'Auditoría', can('audit.read')]] as const; return <div className="app-shell"><aside><div className="side-brand"><span className="brand-mark small">N</span><strong>NEXUS</strong></div><nav>{links.filter((link) => link[2]).map(([path, label]) => <Link className={location.pathname.startsWith(path) ? 'active' : ''} to={path} key={path}>{label}</Link>)}</nav><button className="ghost" onClick={() => logout()}>Cerrar sesión</button></aside><section className="workspace"><header><div><p className="eyebrow">CENTRO DE CONTROL</p><h1>{user.firstName} {user.lastName}</h1></div><div className="user-chip">{user.email}</div></header><main className="content"><Outlet /></main></section></div>; }

function DashboardPage() { const { data, loading, error } = useResource<Row>('/dashboard/summary'); if (loading) return <Loading />; if (error) return <ErrorState message={error} />; const cards = [['Ventas hoy', data?.ventasHoy], ['Ventas mes', data?.ventasMes], ['Compras mes', data?.comprasMes], ['Clientes activos', data?.clientesActivos], ['Stock bajo', data?.stockBajo], ['Agotados', data?.productosAgotados], ['Inventario valorizado', data?.inventarioValorizado]]; return <><div className="section-heading"><div><p className="eyebrow">RESUMEN OPERATIVO</p><h2>Dashboard</h2><p className="muted">Datos reales de la empresa autenticada.</p></div><span className="status-dot">API conectada</span></div><div className="metrics">{cards.map(([label, value]) => <article className="metric" key={String(label)}><span>{String(label)}</span><strong>{typeof value === 'number' ? value.toLocaleString('es-ES') : '-'}</strong><small>Actualizado ahora</small></article>)}</div><div className="lower-grid"><Recent title="Ventas recientes" rows={(data?.ventasRecientes as Row[] | undefined) ?? []} /><Recent title="Movimientos recientes" rows={(data?.movimientosRecientes as Row[] | undefined) ?? []} /></div></>; }
function Loading() { return <div className="panel"><p className="muted">Cargando datos...</p></div>; }
function ErrorState({ message }: { message: string }) { return <div className="error">{message}</div>; }
function Recent({ title, rows }: { title: string; rows: Row[] }) { return <article className="panel"><div className="panel-title"><h3>{title}</h3><span>{rows.length} registros</span></div>{rows.length === 0 ? <p className="muted">No hay registros recientes.</p> : <div className="recent-list">{rows.map((row, index) => <div className="recent-row" key={String(row.id ?? index)}><span>{String(row.productName ?? row.customerName ?? row.type ?? 'Registro')}</span><strong>{String(row.total ?? row.quantity ?? '')}</strong></div>)}</div>}</article>; }
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
    <div className="section-heading"><div><p className="eyebrow">MÓDULO</p><h2>{config.label}</h2><p className="muted">{String(data?.meta?.total ?? items.length)} registros disponibles.</p></div>{resource === 'products' && can('products.write') && <Link className="primary link-button" to="/products/new">Nuevo producto</Link>}{resource === 'categories' && can('categories.write') && <Link className="primary link-button" to="/categories/new">Nueva categoría</Link>}</div>
    {config.searchable && <form className="search-bar" onSubmit={applySearch}><input aria-label={`Buscar ${config.label.toLowerCase()}`} placeholder="Buscar…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /><button type="submit">Buscar</button></form>}
    {loading ? <Loading /> : error ? <ErrorState message={error} /> : <div className="panel table-panel">{items.length === 0 ? <p className="muted">No hay registros para mostrar.</p> : <table><thead><tr><th>Nombre / código</th><th>Estado</th><th>Identificador</th></tr></thead><tbody>{items.map((item, index) => <tr key={String(item.id ?? index)}><td>{resource === 'products' && can('products.write') ? <Link to={`/products/${String(item.id)}`}>{String(item.name ?? item.code ?? item.sku ?? '-')}</Link> : resource === 'categories' && can('categories.write') ? <Link to={`/categories/${String(item.id)}`}>{String(item.name ?? '-')}</Link> : String(item.name ?? item.code ?? item.sku ?? item.productName ?? item.customerName ?? item.supplierName ?? '-')}</td><td>{String(item.status ?? (item.isActive === false ? 'inactive' : 'active'))}</td><td>{String(item.id ?? '-')}</td></tr>)}</tbody></table>}</div>}
    <div className="pagination"><button type="button" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</button><span>Página {page} de {totalPages}</span><button type="button" disabled={loading || page >= totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</button></div>
  </>;
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
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [discount, setDiscount] = useState('0');
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
      await apiRequest('/sales', { method: 'POST', body: JSON.stringify({ customerId, warehouseId, notes: notes.trim() || undefined, items: [{ productId, quantity: Number(quantity), discount: Number(discount) }] }) });
      navigate('/sales');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo crear la venta'); }
    finally { setSaving(false); }
  }
  if (!can('sales.write')) return <ErrorState message="No tienes permiso para crear ventas." />;
  if (loading) return <Loading />;
  const select = (label: string, value: string, update: (next: string) => void, rows: Row[]) => <label>{label}<select required value={value} onChange={(event) => update(event.target.value)}><option value="">Selecciona…</option>{rows.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name ?? row.sku ?? row.id)}</option>)}</select></label>;
  return <div className="panel"><p className="eyebrow">VENTAS</p><h2>Nueva venta</h2><p className="muted">La venta se crea pendiente. El precio e impuestos se calculan en el servidor y el stock se descuenta al confirmar.</p>{error && <ErrorState message={error} />}<form className="product-form" onSubmit={(event) => void submit(event)}>{select('Cliente', customerId, setCustomerId, customers)}{select('Almacén', warehouseId, setWarehouseId, warehouses)}{select('Producto', productId, setProductId, products)}<label>Cantidad<input type="number" min="1" step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>Descuento (%)<input type="number" min="0" max="100" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label><label>Notas<textarea maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="form-actions"><button type="button" onClick={() => navigate('/sales')}>Cancelar</button><button className="primary" disabled={saving || !customers.length || !warehouses.length || !products.length}>{saving ? 'Guardando…' : 'Crear venta pendiente'}</button></div></form></div>;
}

function SalesPage() {
  const { can } = useAuth();
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const { data, loading } = useResource<{ items: Row[]; meta: Row }>(`/sales?page=1&limit=20&refresh=${refresh}`);
  async function transition(id: string, action: 'confirm' | 'cancel') {
    setError('');
    try { await apiRequest(`/sales/${id}/${action}`, { method: 'POST' }); setRefresh((value) => value + 1); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar la venta'); }
  }
  return <><div className="section-heading"><div><p className="eyebrow">MÓDULO</p><h2>Ventas</h2><p className="muted">{String(data?.meta?.total ?? 0)} registros disponibles.</p></div>{can('sales.write') && <Link className="primary link-button" to="/sales/new">Nueva venta</Link>}</div>{error && <ErrorState message={error} />}{loading ? <Loading /> : <div className="panel table-panel">{!data?.items?.length ? <p className="muted">No hay ventas para mostrar.</p> : <table><thead><tr><th>Cliente</th><th>Estado</th><th>Total</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>{data.items.map((sale) => <tr key={String(sale.id)}><td>{String(sale.customerName ?? '-')}</td><td>{String(sale.status)}</td><td>{typeof sale.total === 'number' ? sale.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '-'}</td><td>{sale.saleDate ? new Date(String(sale.saleDate)).toLocaleDateString('es-MX') : '-'}</td><td>{sale.status === 'pending' && can('sales.confirm') && <button type="button" onClick={() => void transition(String(sale.id), 'confirm')}>Confirmar</button>} {sale.status === 'pending' && can('sales.cancel') && <button type="button" onClick={() => void transition(String(sale.id), 'cancel')}>Cancelar</button>}</td></tr>)}</tbody></table>}</div>}</>;
}

function PurchaseCreatePage() {
  const navigate = useNavigate(); const { can } = useAuth();
  const [suppliers, setSuppliers] = useState<Row[]>([]); const [warehouses, setWarehouses] = useState<Row[]>([]); const [products, setProducts] = useState<Row[]>([]);
  const [supplierId, setSupplierId] = useState(''); const [warehouseId, setWarehouseId] = useState(''); const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1'); const [unitCost, setUnitCost] = useState('0'); const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([apiRequest<{ items: Row[] }>('/suppliers?limit=100'), apiRequest<{ items: Row[] }>('/warehouses?limit=100'), apiRequest<{ items: Row[] }>('/products?limit=100&status=active')])
      .then(([s, w, p]) => { if (active) { setSuppliers(s.items ?? []); setWarehouses(w.items ?? []); setProducts(p.items ?? []); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los datos'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await apiRequest('/purchases', { method: 'POST', body: JSON.stringify({ supplierId, warehouseId, notes: notes.trim() || undefined, items: [{ productId, quantity: Number(quantity), unitCost: Number(unitCost), discount: 0, taxes: [] }] }) }); navigate('/purchases'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo crear la compra'); } finally { setSaving(false); } }
  if (!can('purchases.write')) return <ErrorState message="No tienes permiso para crear compras." />; if (loading) return <Loading />;
  const select = (label: string, value: string, update: (next: string) => void, rows: Row[]) => <label>{label}<select required value={value} onChange={(event) => update(event.target.value)}><option value="">Selecciona…</option>{rows.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name ?? row.sku ?? row.id)}</option>)}</select></label>;
  return <div className="panel"><p className="eyebrow">COMPRAS</p><h2>Nueva compra</h2><p className="muted">La compra inicia pendiente. Confírmala antes de registrar una recepción.</p>{error && <ErrorState message={error} />}<form className="product-form" onSubmit={(event) => void submit(event)}>{select('Proveedor', supplierId, setSupplierId, suppliers)}{select('Almacén', warehouseId, setWarehouseId, warehouses)}{select('Producto', productId, setProductId, products)}<label>Cantidad<input type="number" min="1" step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>Costo unitario<input type="number" min="0" step="0.01" required value={unitCost} onChange={(event) => setUnitCost(event.target.value)} /></label><label>Notas<textarea maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="form-actions"><button type="button" onClick={() => navigate('/purchases')}>Cancelar</button><button className="primary" disabled={saving || !suppliers.length || !warehouses.length || !products.length}>{saving ? 'Guardando…' : 'Crear compra pendiente'}</button></div></form></div>;
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
  const { can } = useAuth(); const [refresh, setRefresh] = useState(0); const [error, setError] = useState('');
  const { data, loading } = useResource<{ items: Row[]; meta: Row }>(`/purchases?page=1&limit=20&refresh=${refresh}`);
  async function confirm(id: string) { setError(''); try { await apiRequest(`/purchases/${id}/confirm`, { method: 'POST' }); setRefresh((value) => value + 1); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo confirmar la compra'); } }
  return <><div className="section-heading"><div><p className="eyebrow">MÓDULO</p><h2>Compras</h2><p className="muted">{String(data?.meta?.total ?? 0)} registros disponibles.</p></div>{can('purchases.write') && <Link className="primary link-button" to="/purchases/new">Nueva compra</Link>}</div>{error && <ErrorState message={error} />}{loading ? <Loading /> : <div className="panel table-panel">{!data?.items?.length ? <p className="muted">No hay compras para mostrar.</p> : <table><thead><tr><th>Proveedor</th><th>Estado</th><th>Total</th><th>Acciones</th></tr></thead><tbody>{data.items.map((purchase) => <tr key={String(purchase.id)}><td>{String(purchase.supplierName ?? '-')}</td><td>{String(purchase.status)}</td><td>{typeof purchase.total === 'number' ? purchase.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '-'}</td><td>{purchase.status === 'pending' && can('purchases.confirm') && <button type="button" onClick={() => void confirm(String(purchase.id))}>Confirmar</button>} {['confirmed', 'partially_received'].includes(String(purchase.status)) && can('purchases.receive') && <Link to={`/purchases/${String(purchase.id)}/receive`}>Recibir</Link>}</td></tr>)}</tbody></table>}</div>}</>;
}

function FormPage() { const { resource } = useParams(); return <div className="panel"><p className="eyebrow">NUEVO REGISTRO</p><h2>{resources[resource ?? '']?.label ?? 'Registro'}</h2><p className="muted">El formulario conectado de este módulo se incorporará sobre el contrato API correspondiente.</p><Link className="primary link-button" to={`/${resource}`}>Volver al listado</Link></div>; }
function ReportsPage() { const { user, can } = useAuth(); const [error, setError] = useState(''); const [downloading, setDownloading] = useState<string | null>(null); async function download(type: string) { setError(''); setDownloading(type); try { const result = await downloadReport(`/reports/${type}.csv`); const url = URL.createObjectURL(result.blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = result.filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo descargar el reporte'); } finally { setDownloading(null); } } const types = ['sales', 'purchases', 'inventory', 'inventory-movements', 'products', 'customers', 'suppliers']; return <div className="panel"><p className="eyebrow">REPORTES</p><h2>Exportaciones</h2><p className="muted">Descarga datos de la empresa autenticada.</p>{error && <p className="error">{error}</p>}<div className="report-links">{types.map((type) => <button type="button" disabled={!can('reports.export') || downloading !== null} onClick={() => void download(type)} key={type}>{downloading === type ? 'Descargando…' : type}</button>)}</div>{!can('reports.export') && <p className="muted">Tu rol no tiene permiso para exportar reportes.</p>}<small className="muted">Usuario: {user?.email}</small></div>; }
function AppRoutes() { return <Routes><Route path="/login" element={<LoginPage />} /><Route element={<Shell />}><Route path="/dashboard" element={<DashboardPage />} /><Route path="/reports" element={<ReportsPage />} /><Route path="/products/new" element={<ProductFormPage />} /><Route path="/products/:id" element={<ProductFormPage />} /><Route path="/categories/new" element={<CategoryFormPage />} /><Route path="/categories/:id" element={<CategoryFormPage />} /><Route path="/sales/new" element={<SaleCreatePage />} /><Route path="/sales" element={<SalesPage />} /><Route path="/purchases/new" element={<PurchaseCreatePage />} /><Route path="/purchases/:id/receive" element={<PurchaseReceivePage />} /><Route path="/purchases" element={<PurchasesPage />} />{Object.keys(resources).filter((resource) => !['sales', 'purchases'].includes(resource)).map((resource) => <Route path={`/${resource}`} element={<ResourcePage resource={resource} />} key={resource} />)}<Route path="/:resource/new" element={<FormPage />} /><Route path="*" element={<Navigate to="/dashboard" replace />} /></Route></Routes>; }
export default function Root() { return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>; }
