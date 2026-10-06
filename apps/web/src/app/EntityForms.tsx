import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { apiRequest } from '../services/api';

type Row = Record<string, unknown>;
type EntityKind = 'customers' | 'suppliers' | 'warehouses' | 'branches' | 'companies' | 'users' | 'roles';
type Field = { key: string; label: string; type?: 'text' | 'email' | 'tel' | 'number' | 'url' | 'password' | 'textarea' | 'select'; required?: boolean; options?: Array<{ value: string; label: string }> };

const permissionGroupTitles: Record<string, string> = {
  users: 'Usuarios y roles', roles: 'Usuarios y roles',
  companies: 'Empresas y sucursales', branches: 'Empresas y sucursales',
  categories: 'Catálogo', products: 'Catálogo',
  customers: 'Contactos', suppliers: 'Contactos',
  warehouses: 'Almacén e inventario', inventory: 'Almacén e inventario',
  sales: 'Ventas', purchases: 'Compras',
  dashboard: 'Reportes y auditoría', reports: 'Reportes y auditoría', audit: 'Reportes y auditoría', settings: 'Reportes y auditoría',
};

function groupPermissions(permissions: string[]): Array<{ title: string; values: string[] }> {
  const groups = new Map<string, string[]>();
  for (const permission of permissions) {
    const prefix = permission.split('.')[0] ?? '';
    const title = permissionGroupTitles[prefix] ?? 'Otros permisos';
    groups.set(title, [...(groups.get(title) ?? []), permission]);
  }
  return [...groups].map(([title, values]) => ({ title, values }));
}

const permissionGroupOrder = [
  'Usuarios y roles', 'Empresas y sucursales', 'Catálogo', 'Contactos',
  'Almacén e inventario', 'Ventas', 'Compras', 'Reportes y auditoría', 'Otros permisos',
];

const fieldsFor: Record<Exclude<EntityKind, 'users' | 'roles'>, Field[]> = {
  customers: [
    { key: 'name', label: 'Nombre', required: true }, { key: 'email', label: 'Correo', type: 'email' },
    { key: 'phone', label: 'Teléfono', type: 'tel' }, { key: 'dni', label: 'Identificación' },
    { key: 'address.street', label: 'Calle y número' }, { key: 'address.city', label: 'Ciudad' },
    { key: 'address.state', label: 'Estado / provincia' }, { key: 'address.zipCode', label: 'Código postal' },
    { key: 'notes', label: 'Notas', type: 'textarea' },
  ],
  suppliers: [
    { key: 'name', label: 'Razón social / nombre', required: true }, { key: 'contactName', label: 'Persona de contacto' },
    { key: 'email', label: 'Correo', type: 'email' }, { key: 'phone', label: 'Teléfono', type: 'tel' },
    { key: 'ruc', label: 'RFC / identificación fiscal' }, { key: 'address.street', label: 'Calle y número' },
    { key: 'address.city', label: 'Ciudad' }, { key: 'address.state', label: 'Estado / provincia' },
    { key: 'address.zipCode', label: 'Código postal' }, { key: 'notes', label: 'Notas', type: 'textarea' },
  ],
  warehouses: [
    { key: 'name', label: 'Nombre del almacén', required: true }, { key: 'address', label: 'Dirección' },
    { key: 'branchId', label: 'Sucursal', type: 'select', options: [{ value: '', label: 'Sin sucursal' }] },
  ],
  branches: [
    { key: 'code', label: 'Código', required: true }, { key: 'name', label: 'Nombre', required: true },
    { key: 'address', label: 'Dirección' }, { key: 'phone', label: 'Teléfono', type: 'tel' },
    { key: 'email', label: 'Correo', type: 'email' }, { key: 'manager', label: 'Responsable' },
  ],
  companies: [
    { key: 'name', label: 'Nombre comercial', required: true }, { key: 'legalName', label: 'Razón social' },
    { key: 'taxId', label: 'RFC / identificación fiscal' }, { key: 'phone', label: 'Teléfono', type: 'tel' },
    { key: 'email', label: 'Correo', type: 'email' }, { key: 'address', label: 'Dirección' },
    { key: 'status', label: 'Estado', type: 'select', options: [{ value: 'active', label: 'Activa' }, { value: 'inactive', label: 'Inactiva' }] },
    { key: 'settingsJson', label: 'Configuración (JSON)', type: 'textarea' },
  ],
};

const labels: Record<EntityKind, string> = {
  customers: 'cliente', suppliers: 'proveedor', warehouses: 'almacén', branches: 'sucursal',
  companies: 'empresa', users: 'usuario', roles: 'rol',
};

function setNested(target: Row, path: string, value: unknown) {
  const [head, ...tail] = path.split('.');
  if (!head) return;
  if (tail.length === 0) target[head] = value;
  else {
    const child = target[head] && typeof target[head] === 'object' ? target[head] as Row : {};
    target[head] = child;
    setNested(child, tail.join('.'), value);
  }
}

function readValue(data: Row, path: string): string {
  const value = path.split('.').reduce<unknown>((current, part) => current && typeof current === 'object' ? (current as Row)[part] : undefined, data);
  return value == null ? '' : String(value);
}

export function EntityFormPage() {
  const { resource, id } = useParams();
  const navigate = useNavigate();
  const { can, user, logout } = useAuth();
  const kind = (resource ?? '') as EntityKind;
  const isKnown = ['customers', 'suppliers', 'warehouses', 'branches', 'companies', 'users', 'roles'].includes(kind);
  const [values, setValues] = useState<Row>({ isActive: true, status: 'active', permissions: [] });
  const [branches, setBranches] = useState<Row[]>([]);
  const [roles, setRoles] = useState<Row[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<string[]>([]);
  const [permissionCatalogLoading, setPermissionCatalogLoading] = useState(false);
  const [userHistory, setUserHistory] = useState<Row | null>(null);
  const [userHistoryError, setUserHistoryError] = useState('');
  const [relatedHistory, setRelatedHistory] = useState<Row[]>([]);
  const [relatedHistoryError, setRelatedHistoryError] = useState('');
  const [relatedHistoryLoading, setRelatedHistoryLoading] = useState(false);
  const [warehouseStock, setWarehouseStock] = useState<Row[]>([]);
  const [warehouseStockError, setWarehouseStockError] = useState('');
  const [warehouseStockLoading, setWarehouseStockLoading] = useState(false);
  const canReadInventory = can('inventory.read');
  const [entityLoaded, setEntityLoaded] = useState(!id);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const writePermission = kind === 'companies' ? 'companies.write' : `${kind}.write`;
  const readPermission = kind === 'companies' ? 'companies.read' : `${kind}.read`;
  const title = labels[kind] ?? 'registro';
  const isSystemRole = values.isSystem === true;
  const roleFields = useMemo(() => Array.isArray(values.permissions) ? values.permissions.map(String) : [], [values.permissions]);

  useEffect(() => {
    let active = true;
    setEntityLoaded(!id);
    setLoading(Boolean(id));
    setError('');
    setUserHistoryError(''); setRelatedHistoryError(''); setWarehouseStockError('');
    if (!isKnown) return () => { active = false; };
    if (kind === 'roles') {
      setPermissionCatalogLoading(true);
      apiRequest<{ permissions: string[] }>('/permissions')
        .then((result) => { if (active) setPermissionCatalog(result.permissions ?? []); })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el catálogo de permisos'); })
        .finally(() => { if (active) setPermissionCatalogLoading(false); });
    }
    if (kind === 'warehouses') apiRequest<{ items: Row[] }>('/branches?limit=100&status=active').then((result) => { if (active) setBranches(result.items ?? []); }).catch(() => undefined);
    if (kind === 'users') apiRequest<{ items: Row[] }>('/roles?limit=100').then((result) => { if (active) setRoles(result.items ?? []); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los roles'); });
    if (kind === 'users' && id) apiRequest<Row>(`/users/${id}/history`).then((result) => { if (active) setUserHistory(result); }).catch((reason) => { if (active) setUserHistoryError(reason instanceof Error ? reason.message : 'No se pudo cargar el historial de acceso'); });
    if (kind === 'customers' && id) { setRelatedHistoryLoading(true); apiRequest<{ items: Row[] }>(`/sales?customerId=${encodeURIComponent(id)}&limit=100`).then((result) => { if (active) setRelatedHistory(result.items ?? []); }).catch((reason) => { if (active) setRelatedHistoryError(reason instanceof Error ? reason.message : 'No se pudo cargar el historial de ventas'); }).finally(() => { if (active) setRelatedHistoryLoading(false); }); }
    if (kind === 'suppliers' && id) { setRelatedHistoryLoading(true); apiRequest<{ items: Row[] }>(`/purchases?supplierId=${encodeURIComponent(id)}&limit=100`).then((result) => { if (active) setRelatedHistory(result.items ?? []); }).catch((reason) => { if (active) setRelatedHistoryError(reason instanceof Error ? reason.message : 'No se pudo cargar el historial de compras'); }).finally(() => { if (active) setRelatedHistoryLoading(false); }); }
    if (kind === 'warehouses' && id && canReadInventory) { setWarehouseStockLoading(true); apiRequest<{ items: Row[] }>(`/warehouses/${id}/inventory?limit=100`).then((result) => { if (active) setWarehouseStock(result.items ?? []); }).catch((reason) => { if (active) setWarehouseStockError(reason instanceof Error ? reason.message : 'No se pudo cargar el inventario del almacén'); }).finally(() => { if (active) setWarehouseStockLoading(false); }); }
    if (id) {
      apiRequest<Row>(`/${kind}/${id}`)
        .then((item) => { if (active) { setValues({ ...item, settingsJson: JSON.stringify(item.settings ?? {}, null, 2), password: '', ...(['customers', 'suppliers'].includes(kind) ? { address: item.address && typeof item.address === 'object' ? item.address : {} } : {}) }); setEntityLoaded(true); } })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : `No se pudo cargar el ${title}`); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [id, kind, isKnown, title, canReadInventory]);

  function update(key: string, value: unknown) {
    setValues((current) => {
      const next = { ...current, ...(['customers', 'suppliers'].includes(kind) ? { address: current.address && typeof current.address === 'object' ? { ...current.address as Row } : {} } : {}) };
      setNested(next, key, value);
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    if (kind === 'roles' && (!permissionCatalog.length || permissionCatalogLoading)) {
      setSaving(false); setError('No se pudo cargar el catálogo de permisos. Vuelve a abrir el formulario antes de guardar.'); return;
    }
    const body: Row = { ...values };
    delete body.id; delete body.companyId; delete body.createdAt; delete body.updatedAt; delete body.isSystem; delete body.userCount;
    if (kind === 'companies') {
      try { body.settings = JSON.parse(String(body.settingsJson || '{}')) as Record<string, unknown>; }
      catch { setSaving(false); setError('La configuración debe ser un JSON válido.'); return; }
      delete body.settingsJson;
    }
    if (kind === 'users' && id) delete body.password;
    if (kind === 'users' && !id && !String(body.password ?? '')) { setSaving(false); setError('La contraseña inicial es obligatoria.'); return; }
    if (kind === 'warehouses' && !body.branchId) { if (id) body.branchId = null; else delete body.branchId; }
    try {
      await apiRequest(id ? `/${kind}/${id}` : `/${kind}`, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      navigate(`/${kind}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : `No se pudo guardar el ${title}`); }
    finally { setSaving(false); }
  }

  async function toggleUser() {
    if (!id) return;
    setSaving(true); setError('');
    try {
      const action = values.isActive === false ? 'activate' : 'deactivate';
      await apiRequest(`/users/${id}/${action}`, { method: 'POST' });
      setValues((current) => ({ ...current, isActive: action === 'activate' }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo cambiar el estado'); }
    finally { setSaving(false); }
  }

  async function revokeUserSessions() {
    if (!id || !window.confirm('¿Cerrar todas las sesiones activas de este usuario? Tendrá que iniciar sesión de nuevo.')) return;
    setSaving(true); setError(''); setUserHistoryError('');
    try {
      await apiRequest(`/users/${id}/revoke-sessions`, { method: 'POST' });
      const revokedAt = new Date().toISOString();
      setUserHistory((current) => current ? {
        ...current,
        sessions: ((current.sessions as Row[]) ?? []).map((session) => session.active
          ? { ...session, active: false, revokedAt }
          : session),
      } : current);
      if (user?.id === id) {
        await logout();
        navigate('/login', { replace: true });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron revocar las sesiones');
    } finally { setSaving(false); }
  }

  async function deleteRole() {
    if (!id || !window.confirm('¿Eliminar este rol personalizado?')) return;
    setSaving(true); setError('');
    try { await apiRequest(`/roles/${id}`, { method: 'DELETE' }); navigate('/roles'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo eliminar el rol'); }
    finally { setSaving(false); }
  }

  if (!isKnown) return <div className="panel"><h2>Módulo no disponible</h2><p className="muted">No existe un formulario para este recurso.</p></div>;
  if (!can(readPermission) || !can(writePermission)) return <div className="error">Tu rol no tiene permiso para {id ? 'editar' : 'crear'} {title === 'almacén' ? 'el almacén' : `el ${title}`}.</div>;
  if (loading) return <div className="panel"><p className="muted">Cargando {title}…</p></div>;
  if (id && !entityLoaded) return <div className="panel"><h2>No se pudo abrir este {title}</h2><p className="error">{error || `No se pudo cargar el ${title}.`}</p><Link className="secondary-button" to={`/${kind}`}>Volver al listado</Link></div>;

  const fields = kind === 'users'
    ? [{ key: 'firstName', label: 'Nombre', required: true }, { key: 'lastName', label: 'Apellido', required: true }, { key: 'email', label: 'Correo', type: 'email' as const, required: true }, { key: 'roleId', label: 'Rol', type: 'select' as const, required: true }, ...(!id ? [{ key: 'password', label: 'Contraseña inicial (mínimo 12 caracteres)', type: 'password' as const, required: true }] : [])]
    : kind === 'roles' ? [{ key: 'name', label: 'Clave del rol (minúsculas, guiones o guion bajo)', required: true }, { key: 'displayName', label: 'Nombre visible', required: true }]
      : fieldsFor[kind];

  return <div className="panel entity-form-panel">
    <p className="eyebrow">{kind.toUpperCase()}</p>
    <h2>{id ? `Editar ${title}` : `Nuevo ${title}`}</h2>
    <p className="muted">Los cambios se guardan en la empresa de tu sesión.</p>
    {error && <p className="error">{error}</p>}
    <form className="product-form entity-form" onSubmit={(event) => void submit(event)}>
      {fields.map((field) => <label key={field.key}>{field.label}
        {field.key === 'roleId' ? <select required value={String(values.roleId ?? '')} onChange={(event) => update(field.key, event.target.value)}><option value="">Selecciona un rol</option>{roles.map((role) => <option key={String(role.id)} value={String(role.id)}>{String(role.displayName ?? role.name)}</option>)}</select>
          : field.key === 'branchId' ? <select value={String(values.branchId ?? '')} onChange={(event) => update(field.key, event.target.value)}><option value="">Sin sucursal</option>{branches.map((branch) => <option key={String(branch.id)} value={String(branch.id)}>{String(branch.name)}</option>)}</select>
            : field.type === 'select' ? <select required={field.required} value={String(values[field.key] ?? '')} onChange={(event) => update(field.key, event.target.value)}>{(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            : field.type === 'textarea' ? <textarea maxLength={1000} value={readValue(values, field.key)} onChange={(event) => update(field.key, event.target.value)} />
              : <input type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'} minLength={field.key === 'password' ? 12 : undefined} maxLength={field.key === 'password' ? 128 : 254} required={field.required} disabled={Boolean(kind === 'roles' && id && field.key === 'name')} value={readValue(values, field.key)} onChange={(event) => update(field.key, event.target.value)} />}
      </label>)}
      {kind === 'roles' && <fieldset className="permission-grid"><legend>Permisos del rol</legend>{permissionCatalogLoading ? <p className="muted">Cargando permisos disponibles…</p> : permissionCatalog.length ? groupPermissions(permissionCatalog).sort((a, b) => permissionGroupOrder.indexOf(a.title) - permissionGroupOrder.indexOf(b.title)).map((group) => <section key={group.title}><h3>{group.title}</h3>{group.values.map((permission) => <label className="checkbox-label" key={permission}><input type="checkbox" checked={roleFields.includes(permission)} onChange={(event) => update('permissions', event.target.checked ? [...roleFields, permission] : roleFields.filter((value) => value !== permission))} />{permission}</label>)}</section>) : <p className="error">El catálogo de permisos no está disponible; no guardes cambios hasta poder cargarlo.</p>}</fieldset>}
      {kind === 'users' && id && <section className="user-history"><h3>Historial de acceso</h3>{userHistoryError ? <p className="error">{userHistoryError}</p> : userHistory ? <><p>Cuenta creada: {userHistory.createdAt ? new Date(String(userHistory.createdAt)).toLocaleString('es-MX') : '—'}</p><p>Último inicio de sesión: {userHistory.lastLoginAt ? new Date(String(userHistory.lastLoginAt)).toLocaleString('es-MX') : 'Sin registros'}</p><p>Contraseña cambiada: {userHistory.passwordChangedAt ? new Date(String(userHistory.passwordChangedAt)).toLocaleString('es-MX') : '—'}</p><h4>Sesiones</h4>{((userHistory.sessions as Row[]) ?? []).length ? <ul>{((userHistory.sessions as Row[]) ?? []).map((session, index) => <li key={String(session.id ?? index)}>{session.active ? 'Activa' : session.revokedAt ? 'Revocada' : 'Expirada'} · último uso {session.lastUsedAt ? new Date(String(session.lastUsedAt)).toLocaleString('es-MX') : '—'} · vence {session.expiresAt ? new Date(String(session.expiresAt)).toLocaleString('es-MX') : '—'}</li>)}</ul> : <p className="muted">No hay sesiones para mostrar.</p>}{can('users.write') && ((userHistory.sessions as Row[]) ?? []).some((session) => session.active) && <button type="button" disabled={saving} onClick={() => void revokeUserSessions()}>{saving ? 'Cerrando sesiones…' : 'Cerrar todas las sesiones activas'}</button>}</> : <p className="muted">Cargando historial de acceso…</p>}</section>}
      {id && ['customers', 'suppliers'].includes(kind) && <section className="user-history"><h3>{kind === 'customers' ? 'Historial de ventas del cliente' : 'Historial de compras al proveedor'}</h3>{relatedHistoryError ? <p className="error">{relatedHistoryError}</p> : relatedHistoryLoading ? <p className="muted">Cargando historial…</p> : relatedHistory.length ? <ul>{relatedHistory.map((entry) => <li key={String(entry.id)}>{entry.saleDate || entry.purchaseDate ? new Date(String(entry.saleDate ?? entry.purchaseDate)).toLocaleDateString('es-MX') : 'Fecha desconocida'} · {String(entry.status)} · {Number(entry.total ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</li>)}</ul> : <p className="muted">No hay operaciones registradas para esta ficha.</p>}</section>}
      {kind === 'warehouses' && id && canReadInventory && <section className="user-history"><h3>Existencias en este almacén</h3>{warehouseStockError ? <p className="error">{warehouseStockError}</p> : warehouseStockLoading ? <p className="muted">Cargando existencias…</p> : warehouseStock.length ? <div className="table-panel"><table><thead><tr><th>Producto</th><th>Existencia</th><th>Mínimo</th><th>Estado</th></tr></thead><tbody>{warehouseStock.map((stock, index) => { const quantity = Number(stock.quantity ?? 0); const availability = quantity <= 0 ? 'Agotado' : stock.lowStock === true ? 'Stock bajo' : 'Disponible'; return <tr key={String(stock.id ?? index)}><td>{String(stock.productName ?? stock.productSku ?? '—')}</td><td>{String(quantity)}</td><td>{String(stock.minStock ?? 0)}</td><td>{availability}</td></tr>; })}</tbody></table></div> : <p className="muted">Este almacén todavía no tiene existencias.</p>}</section>}
      {kind === 'branches' && id && <label className="checkbox-label"><input type="checkbox" checked={values.isActive !== false} onChange={(event) => update('isActive', event.target.checked)} />Sucursal activa</label>}
      {kind === 'warehouses' && id && <label className="checkbox-label"><input type="checkbox" checked={values.isActive !== false} onChange={(event) => update('isActive', event.target.checked)} />Almacén activo</label>}
      {kind === 'customers' && id && <label className="checkbox-label"><input type="checkbox" checked={values.isActive !== false} onChange={(event) => update('isActive', event.target.checked)} />Cliente activo</label>}
      {kind === 'suppliers' && id && <label className="checkbox-label"><input type="checkbox" checked={values.isActive !== false} onChange={(event) => update('isActive', event.target.checked)} />Proveedor activo</label>}
      <div className="form-actions"><Link className="secondary-button" to={`/${kind}`}>Volver</Link>{kind === 'users' && id && <button type="button" disabled={saving} onClick={() => void toggleUser()}>{values.isActive === false ? 'Activar usuario' : 'Desactivar usuario'}</button>}{kind === 'roles' && isSystemRole && <span className="muted">No puedes eliminar un rol del sistema.</span>}{kind === 'roles' && id && !isSystemRole && <button type="button" disabled={saving || Number(values.userCount) > 0} onClick={() => void deleteRole()} title={Number(values.userCount) > 0 ? 'No se puede eliminar un rol asignado' : undefined}>Eliminar rol</button>}<button className="primary" disabled={saving || (kind === 'roles' && (permissionCatalogLoading || !permissionCatalog.length))}>{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
    </form>
  </div>;
}
