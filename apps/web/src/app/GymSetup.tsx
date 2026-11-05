import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useResource } from '../auth/AuthProvider';
import { apiRequest } from '../services/api';
import { canAccessPath } from './access';
import { GymNavigation } from './GymPages';

type StoreSettings = { enabled: boolean; ready: boolean; companyActive: boolean; conflictingStore: boolean; products: number; published: number };
export function GymSetupPage() {
  const { can } = useAuth(); const [saved, setSaved] = useState<StoreSettings | null>(null); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const request = useResource<StoreSettings>('/store/settings', can('products.read'));
  const store = saved ?? request.data;
  const link = (path: string, label: string) => canAccessPath(path, can) ? <Link className="secondary-button" to={path}>{label}</Link> : null;
  async function toggleStore() {
    if (!store || saving || !can('companies.write')) return;
    setSaving(true); setError('');
    try { setSaved(await apiRequest<StoreSettings>('/store/settings', { method: 'PATCH', body: JSON.stringify({ enabled: !store.enabled }) })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar la tienda'); } finally { setSaving(false); }
  }
  return <><GymNavigation /><div className="section-heading"><div><p className="eyebrow">GYM OMH · ADMINISTRACIÓN</p><h1>Puesta en marcha</h1><p className="muted">Publica productos y prepara las cuentas para probar membresías.</p></div><Link className="secondary-button" to="/tienda">Ver tienda pública</Link></div>
    {(error || request.error) && <p className="error" role="alert">{error || request.error}</p>}
    <div className="gym-setup-grid">
      <section className="panel"><p className="eyebrow">01 · PRODUCTOS Y TIENDA</p><h2>Del ERP al catálogo público</h2><p>Crea el producto con su categoría, precio, descripción e imagen. Marca <strong>Visible en la tienda pública de Gym OMH</strong> y guárdalo.</p>{can('products.read') && (request.loading ? <p role="status">Consultando la tienda…</p> : store && <><p><strong>Estado:</strong> {store.ready ? 'Tienda habilitada' : store.enabled ? 'Configuración pendiente' : 'Tienda deshabilitada'}</p><p>{store.published} productos activos marcados para publicar de {store.products} registrados.</p>{store.conflictingStore && <p className="error">Existe otra empresa con tienda habilitada. Revisa Empresa antes de publicar.</p>}{!store.companyActive && <p className="error">La empresa está inactiva.</p>}{can('companies.write') ? <button type="button" disabled={saving || (!store.enabled && (!store.companyActive || store.conflictingStore))} onClick={() => void toggleStore()}>{saving ? 'Guardando…' : store.enabled ? 'Deshabilitar tienda' : 'Habilitar tienda'}</button> : <p className="muted">Un administrador con permiso de edición de empresas puede habilitar la tienda.</p>}</>)}<div className="form-actions">{link('/categories/new', 'Crear categoría')}{link('/products/new', 'Agregar producto')}{link('/products', 'Administrar productos')}</div></section>
      <section className="panel"><p className="eyebrow">02 · SOCIO Y ACCESO</p><h2>Crear una cuenta para el gimnasio</h2><p>Registra el socio. Al guardar se abrirá su ficha: ahí podrás crear su acceso con correo y contraseña inicial.</p><p className="muted">La cuenta del socio solo podrá consultar su membresía y su historial.</p><div className="form-actions">{link('/gym/members/new', 'Registrar socio')}{link('/gym/members', 'Ver socios')}</div></section>
      <section className="panel"><p className="eyebrow">03 · MEMBRESÍA Y VIGENCIA</p><h2>Asignar un plan al socio</h2><p>Crea una membresía con duración y precio. Después registra una inscripción para el socio y selecciona su fecha de inicio.</p><p className="muted">El sistema calcula la fecha final y los días restantes. El socio lo verá al iniciar sesión desde la tienda.</p><div className="form-actions">{link('/gym/plans/new', 'Crear membresía')}{link('/gym/enrollments/new', 'Registrar inscripción')}{link('/gym/enrollments', 'Ver inscripciones')}</div></section>
      <section className="panel"><p className="eyebrow">04 · PERSONAL</p><h2>Crear usuarios administrativos</h2><p>Desde Usuarios puedes dar de alta al personal y asignarle un rol. Para los socios usa su ficha, así su cuenta queda vinculada correctamente.</p><div className="form-actions">{link('/users/new', 'Crear usuario del personal')}{link('/users', 'Administrar usuarios')}{link('/roles', 'Revisar roles')}</div></section>
    </div><p className="muted">Para probar el acceso del socio sin cerrar tu sesión administrativa, abre la tienda en una ventana privada/incógnita o utiliza otro navegador.</p>
  </>;
}
