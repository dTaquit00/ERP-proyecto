import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { apiRequest } from '../services/api';

type Row = Record<string, unknown>;
type EntityKind = 'customers' | 'suppliers' | 'warehouses' | 'branches' | 'companies' | 'users' | 'roles';
type Field = { key: string; label: string; type?: 'text' | 'email' | 'tel' | 'number' | 'url' | 'password' | 'textarea' | 'select'; required?: boolean; options?: Array<{ value: string; label: string }> };

const permissionGroups: Array<{ title: string; values: string[] }> = [
  { title: 'Usuarios y roles', values: ['users.read', 'users.write', 'roles.read', 'roles.write'] },
  { title: 'Empresas y sucursales', values: ['companies.read', 'companies.write', 'branches.read', 'branches.write'] },
  { title: 'Catálogo', values: ['categories.read', 'categories.write', 'products.read', 'products.write'] },
  { title: 'Contactos', values: ['customers.read', 'customers.write', 'suppliers.read', 'suppliers.write'] },
  { title: 'Almacén e inventario', values: ['warehouses.read', 'warehouses.write', 'inventory.read', 'inventory.write', 'inventory.adjust', 'inventory.transfer'] },
  { title: 'Ventas', values: ['sales.read', 'sales.write', 'sales.confirm', 'sales.cancel', 'sales.return'] },
  { title: 'Compras', values: ['purchases.read', 'purchases.write', 'purchases.confirm', 'purchases.receive', 'purchases.cancel'] },
  { title: 'Reportes y auditoría', values: ['dashboard.read', 'reports.read', 'reports.export', 'audit.read', 'settings.read', 'settings.write'] },
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
  const { can } = useAuth();
  const kind = (resource ?? '') as EntityKind;
  const isKnown = ['customers', 'suppliers', 'warehouses', 'branches', 'companies', 'users', 'roles'].includes(kind);
  const [values, setValues] = useState<Row>({ isActive: true, status: 'active', permissions: [] });
  const [branches, setBranches] = useState<Row[]>([]);
  const [roles, setRoles] = useState<Row[]>([]);
  const [userHistory, setUserHistory] = useState<Row | null>(null);
  const [relatedHistory, setRelatedHistory] = useState<Row[]>([]);
  const [warehouseStock, setWarehouseStock] = useState<Row[]>([]);
  const canReadInventory = can('inventory.read');
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
    if (!isKnown) return () => { active = false; };
    if (kind === 'warehouses') apiRequest<{ items: Row[] }>('/branches?limit=100&status=active').then((result) => { if (active) setBranches(result.items ?? []); }).catch(() => undefined);
    if (kind === 'users') apiRequest<{ items: Row[] }>('/roles?limit=100').then((result) => { if (active) setRoles(result.items ?? []); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los roles'); });
    if (kind === 'users' && id) apiRequest<Row>(`/users/${id}/history`).then((result) => { if (active) setUserHistory(result); }).catch(() => undefined);
    if (kind === 'customers' && id) apiRequest<{ items: Row[] }>(`/sales?customerId=${encodeURIComponent(id)}&limit=100`).then((result) => { if (active) setRelatedHistory(result.items ?? []); }).catch(() => undefined);
    if (kind === 'suppliers' && id) apiRequest<{ items: Row[] }>(`/purchases?supplierId=${encodeURIComponent(id)}&limit=100`).then((result) => { if (active) setRelatedHistory(result.items ?? []); }).catch(() => undefined);
    if (kind === 'warehouses' && id && canReadInventory) apiRequest<{ items: Row[] }>(`/warehouses/${id}/inventory?limit=100`).then((result) => { if (active) setWarehouseStock(result.items ?? []); }).catch(() => undefined);
    if (id) {
      apiRequest<Row>(`/${kind}/${id}`)
        .then((item) => { if (active) setValues({ ...item, settingsJson: JSON.stringify(item.settings ?? {}, null, 2), password: '', address: item.address && typeof item.address === 'object' ? item.address : {} }); })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : `No se pudo cargar el ${title}`); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [id, kind, isKnown, title, canReadInventory]);

  function update(key: string, value: unknown) {
    setValues((current) => {
      const next = { ...current, address: current.address && typeof current.address === 'object' ? { ...current.address as Row } : {} };
      setNested(next, key, value);
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
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
      {kind === 'roles' && <fieldset className="permission-grid"><legend>Permisos del rol</legend>{permissionGroups.map((group) => <section key={group.title}><h3>{group.title}</h3>{group.values.map((permission) => <label className="checkbox-label" key={permission}><input type="checkbox" checked={roleFields.includes(permission)} onChange={(event) => update('permissions', event.target.checked ? [...roleFields, permission] : roleFields.filter((value) => value !== permission))} />{permission}</label>)}</section>)}</fieldset>}
      {kind === 'users' && id && userHistory && <section className="user-history"><h3>Historial de acceso</h3><p>Cuenta creada: {userHistory.createdAt ? new Date(String(userHistory.createdAt)).toLocaleString('es-MX') : '—'}</p><p>Último inicio de sesión: {userHistory.lastLoginAt ? new Date(String(userHistory.lastLoginAt)).toLocaleString('es-MX') : 'Sin registros'}</p><p>Contraseña cambiada: {userHistory.passwordChangedAt ? new Date(String(userHistory.passwordChangedAt)).toLocaleString('es-MX') : '—'}</p><h4>Sesiones</h4>{((userHistory.sessions as Row[]) ?? []).length ? <ul>{((userHistory.sessions as Row[]) ?? []).map((session, index) => <li key={String(session.id ?? index)}>{session.active ? 'Activa' : session.revokedAt ? 'Revocada' : 'Expirada'} · último uso {session.lastUsedAt ? new Date(String(session.lastUsedAt)).toLocaleString('es-MX') : '—'} · vence {session.expiresAt ? new Date(String(session.expiresAt)).toLocaleString('es-MX') : '—'}</li>)}</ul> : <p className="muted">No hay sesiones para mostrar.</p>}</section>}
      {id && ['customers', 'suppliers'].includes(kind) && <section className="user-history"><h3>{kind === 'customers' ? 'Historial de compras del cliente' : 'Historial de compras al proveedor'}</h3>{relatedHistory.length ? <ul>{relatedHistory.map((entry) => <li key={String(entry.id)}>{entry.saleDate || entry.purchaseDate ? new Date(String(entry.saleDate ?? entry.purchaseDate)).toLocaleDateString('es-MX') : 'Fecha desconocida'} · {String(entry.status)} · {Number(entry.total ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</li>)}</ul> : <p className="muted">No hay operaciones registradas para esta ficha.</p>}</section>}
      {kind === 'warehouses' && id && canReadInventory && <section className="user-history"><h3>Existencias en este almacén</h3>{warehouseStock.length ? <div className="table-panel"><table><thead><tr><th>Producto</th><th>Existencia</th><th>Mínimo</th><th>Estado</th></tr></thead><tbody>{warehouseStock.map((stock, index) => <tr key={String(stock.id ?? index)}><td>{String(stock.productName ?? stock.sku ?? '—')}</td><td>{String(stock.quantity ?? 0)}</td><td>{String(stock.minStock ?? 0)}</td><td>{String(stock.availability ?? '—')}</td></tr>)}</tbody></table></div> : <p className="muted">Este almacén todavía no tiene existencias.</p>}</section>}
      {kind === 'branches' && id && <label className="checkbox-label"><input type="checkbox" checked={values.isActive !== false} onChange={(event) => update('isActive', event.target.checked)} />Sucursal activa</label>}
      {kind === 'warehouses' && id && <label className="checkbox-label"><input type="checkbox" checked={values.isActive !== false} onChange={(event) => update('isActive', event.target.checked)} />Almacén activo</label>}
      {kind === 'customers' && id && <label className="checkbox-label"><input type="checkbox" checked={values.isActive !== false} onChange={(event) => update('isActive', event.target.checked)} />Cliente activo</label>}
      {kind === 'suppliers' && id && <label className="checkbox-label"><input type="checkbox" checked={values.isActive !== false} onChange={(event) => update('isActive', event.target.checked)} />Proveedor activo</label>}
      <div className="form-actions"><Link className="secondary-button" to={`/${kind}`}>Volver</Link>{kind === 'users' && id && <button type="button" disabled={saving} onClick={() => void toggleUser()}>{values.isActive === false ? 'Activar usuario' : 'Desactivar usuario'}</button>}{kind === 'roles' && isSystemRole && <span className="muted">No puedes eliminar un rol del sistema.</span>}{kind === 'roles' && id && !isSystemRole && <button type="button" disabled={saving || Number(values.userCount) > 0} onClick={() => void deleteRole()} title={Number(values.userCount) > 0 ? 'No se puede eliminar un rol asignado' : undefined}>Eliminar rol</button>}<button className="primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
    </form>
  </div>;
}
