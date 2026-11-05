import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth, useResource } from '../auth/AuthProvider';
import { apiListAll, apiRequest } from '../services/api';
import { getLandingPath } from './navigation';

type Row = Record<string, unknown>;
export type GymKind = 'members' | 'plans' | 'enrollments';
const config = {
  members: { title: 'Socios', single: 'socio', permission: 'members', create: 'Nuevo socio' },
  plans: { title: 'Membresías', single: 'membresía', permission: 'memberships', create: 'Nueva membresía' },
  enrollments: { title: 'Inscripciones', single: 'inscripción', permission: 'enrollments', create: 'Nueva inscripción' },
};
const statuses: Record<string, string> = { scheduled: 'Programada', active: 'Vigente', expired: 'Vencida', cancelled: 'Cancelada' };
const money = (value: unknown) => Number(value ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function ErrorMessage({ error }: { error: string }) { return error ? <p className="error" role="alert">{error}</p> : null; }

function MemberAccountForm({ memberId, hasAccount, email }: { memberId: string; hasAccount: boolean; email: string }) {
  const [accountEmail, setAccountEmail] = useState(email); const [password, setPassword] = useState('');
  const [linked, setLinked] = useState(hasAccount); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (saving || linked) return; setSaving(true); setError('');
    try { await apiRequest(`/gym/members/${memberId}/account`, { method: 'POST', body: JSON.stringify({ email: accountEmail, password }) }); setLinked(true); setPassword(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo crear el acceso'); } finally { setSaving(false); }
  }
  return <section className="user-history"><h2>Acceso privado del socio</h2>{linked ? <p className="muted">Este socio ya tiene una cuenta vinculada. Puede entrar desde la tienda para consultar su membresía.</p> : <><p className="muted">Crea una cuenta con acceso exclusivo a su membresía. Los accesos del personal se administran en Usuarios.</p><ErrorMessage error={error} /><form className="product-form" onSubmit={(event) => void submit(event)}><label>Correo de acceso del socio<input type="email" required maxLength={254} value={accountEmail} disabled={saving} onChange={(event) => setAccountEmail(event.target.value)} /></label><label>Contraseña inicial del socio<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} disabled={saving} onChange={(event) => setPassword(event.target.value)} /></label><button className="primary" disabled={saving}>{saving ? 'Creando acceso…' : 'Crear acceso del socio'}</button></form></>}</section>;
}

export function GymNavigation() {
  const { can } = useAuth();
  return <nav className="module-actions gym-tabs" aria-label="Módulos Gym OMH">{(Object.keys(config) as GymKind[]).filter((kind) => can(`${config[kind].permission}.read`)).map((kind) => <Link className="secondary-button" key={kind} to={`/gym/${kind}`}>{config[kind].title}</Link>)}</nav>;
}

export function GymListPage({ kind }: { kind: GymKind }) {
  const { can } = useAuth(); const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1); const search = params.get('search') ?? ''; const status = params.get('status') ?? '';
  const [draftSearch, setDraftSearch] = useState(search);
  const settings = config[kind];
  const query = new URLSearchParams({ page: String(page), limit: '20' });
  if (search && kind !== 'enrollments') query.set('search', search);
  if (status) query.set('status', status);
  const memberId = params.get('memberId'); if (kind === 'enrollments' && memberId) query.set('memberId', memberId);
  const { data, loading, error } = useResource<{ items: Row[]; meta: { total: number; totalPages: number } }>(`/gym/${kind}?${query}`, can(`${settings.permission}.read`));
  const canCreate = can(`${settings.permission}.write`) && (kind !== 'enrollments' || (can('members.read') && can('memberships.read')));
  function filter(key: string, value: string) { const next = new URLSearchParams(params); next.set('page', '1'); if (value) next.set(key, value); else next.delete(key); setParams(next); }
  return <><GymNavigation /><div className="section-heading"><div><p className="eyebrow">GYM OMH</p><h1>{settings.title}</h1><p className="muted">{data?.meta.total ?? 0} registros en la empresa de tu sesión.</p></div>{canCreate && <Link className="primary link-button" to={`/gym/${kind}/new`}>{settings.create}</Link>}</div>
    <form className="search-bar" onSubmit={(event) => { event.preventDefault(); filter('search', draftSearch); }}>{kind !== 'enrollments' && <><input aria-label={`Buscar ${settings.title.toLowerCase()}`} placeholder={kind === 'members' ? 'Nombre, número de socio o correo' : 'Nombre de la membresía'} maxLength={100} value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /><button type="submit">Buscar</button></>}<label>Estado<select value={status} onChange={(event) => filter('status', event.target.value)}><option value="">Todos</option>{kind === 'enrollments' ? Object.entries(statuses).map(([value, label]) => <option value={value} key={value}>{label}</option>) : <><option value="active">Activos</option><option value="inactive">Inactivos</option></>}</select></label></form>
    <ErrorMessage error={error ?? ''} />{loading ? <p role="status">Cargando {settings.title.toLowerCase()}…</p> : !error && <div className="panel table-panel">{!data?.items.length ? <p className="muted">No hay registros para estos filtros.</p> : <table><thead><tr><th>{kind === 'members' ? 'Socio' : kind === 'plans' ? 'Membresía' : 'Socio / membresía'}</th><th>{kind === 'members' ? 'Contacto' : kind === 'plans' ? 'Duración / precio' : 'Vigencia / monto registrado'}</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>{data.items.map((item) => <tr key={String(item.id)}><td>{kind === 'members' ? <>{String(item.memberNumber)} · {String(item.name)}</> : kind === 'plans' ? String(item.name) : <>{String(item.memberName)}<br />{String(item.planName)}</>}</td><td>{kind === 'members' ? <>{String(item.email || 'Sin correo')}<br />{String(item.phone || 'Sin teléfono')}</> : kind === 'plans' ? <>{String(item.durationDays)} días · {money(item.price)}</> : <>{String(item.startDate)} al {String(item.endDate)}<br />{money(item.amountPaid)} de {money(item.price)}</>}</td><td>{kind === 'enrollments' ? statuses[String(item.status)] : item.isActive ? 'Activo' : 'Inactivo'}</td><td><Link to={`/gym/${kind}/${String(item.id)}`}>Ver {settings.single}</Link></td></tr>)}</tbody></table>}</div>}
    <div className="pagination"><button disabled={loading || Boolean(error) || page <= 1} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page - 1)); setParams(next); }}>Anterior</button><span>Página {page} de {data?.meta.totalPages ?? 1}</span><button disabled={loading || Boolean(error) || page >= (data?.meta.totalPages ?? 1)} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page + 1)); setParams(next); }}>Siguiente</button></div>
  </>;
}

export function GymFormPage({ kind }: { kind: 'members' | 'plans' }) {
  const { id } = useParams(); const { can, user } = useAuth(); const navigate = useNavigate(); const settings = config[kind];
  const canWrite = can(`${settings.permission}.write`);
  const [values, setValues] = useState<Row>({ isActive: true, durationDays: '30', price: '0' });
  const [loading, setLoading] = useState(Boolean(id)); const [loaded, setLoaded] = useState(!id); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    let active = true; setValues({ isActive: true, durationDays: '30', price: '0' }); setLoaded(!id); setLoading(Boolean(id)); setError('');
    if (id) apiRequest<Row>(`/gym/${kind}/${id}`).then((item) => { if (active) { setValues(item); setLoaded(true); } }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el registro'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, kind]);
  const fields: Array<{ key: string; label: string; type?: string; required?: boolean; max?: number; min?: number; maxNumber?: number; step?: string }> = kind === 'members' ? [
    { key: 'memberNumber', label: 'Número de socio', required: true, max: 30 },
    { key: 'firstName', label: 'Nombre(s)', required: true, max: 100 }, { key: 'lastName', label: 'Apellidos', required: true, max: 100 },
    { key: 'email', label: 'Correo', type: 'email', max: 254 }, { key: 'phone', label: 'Teléfono', type: 'tel', max: 30 }, { key: 'notes', label: 'Notas administrativas', type: 'textarea', max: 1000 },
  ] : [
    { key: 'name', label: 'Nombre de la membresía', required: true, max: 100 }, { key: 'description', label: 'Descripción', type: 'textarea', max: 500 },
    { key: 'durationDays', label: 'Duración en días', required: true, type: 'number', min: 1, maxNumber: 730, step: '1' }, { key: 'price', label: 'Precio (MXN)', required: true, type: 'number', min: 0, maxNumber: 1000000, step: '0.01' },
  ];
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!canWrite || saving) return; setSaving(true); setError('');
    const payload: Row = {};
    for (const field of fields) payload[field.key] = field.type === 'number' ? Number(values[field.key]) : String(values[field.key] ?? '');
    payload.isActive = values.isActive !== false;
    try { await apiRequest(`/gym/${kind}${id ? `/${id}` : ''}`, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) }); navigate(can(`${settings.permission}.read`) ? `/gym/${kind}` : getLandingPath(user?.permissions ?? [])); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar'); } finally { setSaving(false); }
  }
  if (loading) return <p role="status">Cargando {settings.single}…</p>;
  return <div className="panel"><GymNavigation /><p className="eyebrow">GYM OMH</p><h1>{id ? `${canWrite ? 'Editar' : 'Consultar'} ${settings.single}` : settings.create}</h1><ErrorMessage error={error} />{loaded && <form className="product-form entity-form" onSubmit={(event) => void submit(event)}>{fields.map((field) => <label key={field.key}>{field.label}{field.type === 'textarea' ? <textarea maxLength={field.max} value={String(values[field.key] ?? '')} disabled={!canWrite || saving} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} /> : <input type={field.type ?? 'text'} required={field.required} maxLength={field.max} min={field.min} max={field.maxNumber} step={field.step} pattern={field.key === 'memberNumber' ? '[A-Za-z0-9_-]+' : undefined} value={String(values[field.key] ?? '')} disabled={!canWrite || saving} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} />}</label>)}{kind === 'members' && <small className="muted">Usa estas notas solo para información administrativa. El socio se vincula a Clientes para registrar sus compras.</small>}<label className="checkbox-label"><input type="checkbox" checked={values.isActive !== false} disabled={!canWrite || saving} onChange={(event) => setValues((current) => ({ ...current, isActive: event.target.checked }))} />{kind === 'members' ? 'Socio activo' : 'Membresía disponible'}</label><div className="form-actions"><Link className="secondary-button" to={can(`${settings.permission}.read`) ? `/gym/${kind}` : getLandingPath(user?.permissions ?? [])}>Volver</Link>{canWrite && <button className="primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>}{id && kind === 'members' && can('enrollments.read') && <Link to={`/gym/enrollments?memberId=${id}`}>Ver inscripciones de este socio</Link>}{id && kind === 'members' && values.customerId && can('customers.read') ? <Link to={`/customers/${String(values.customerId)}`}>Ficha para ventas</Link> : null}</div></form>}{loaded && id && kind === 'members' && can('users.write') && canWrite && <MemberAccountForm key={id} memberId={id} hasAccount={values.hasAccount === true} email={String(values.email ?? '')} />}</div>;
}

export function EnrollmentPage() {
  const { id } = useParams(); const { can, user } = useAuth(); const navigate = useNavigate();
  const [members, setMembers] = useState<Row[]>([]); const [plans, setPlans] = useState<Row[]>([]); const [item, setItem] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const [form, setForm] = useState({ memberId: '', planId: '', startDate: today(), amountPaid: '', notes: '' });
  useEffect(() => {
    let active = true; setLoading(true); setItem(null); setError('');
    const task = id ? apiRequest<Row>(`/gym/enrollments/${id}`).then((result) => { if (active) setItem(result); })
      : Promise.all([apiListAll<Row>('/gym/members?status=active'), apiListAll<Row>('/gym/plans?status=active')]).then(([members, plans]) => { if (active) { setMembers(members.items); setPlans(plans.items); } });
    task.catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (saving || !can('enrollments.write')) return; setSaving(true); setError('');
    try { await apiRequest('/gym/enrollments', { method: 'POST', body: JSON.stringify({ ...form, amountPaid: Number(form.amountPaid) }) }); navigate(can('enrollments.read') ? '/gym/enrollments' : getLandingPath(user?.permissions ?? [])); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo registrar'); } finally { setSaving(false); }
  }
  async function cancel() {
    if (!id || !window.confirm('¿Cancelar la inscripción? Se conserva el historial y el monto registrado. Esta acción no registra un reembolso.')) return;
    setSaving(true); setError('');
    try { setItem(await apiRequest<Row>(`/gym/enrollments/${id}/cancel`, { method: 'POST' })); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo cancelar'); } finally { setSaving(false); }
  }
  const plan = plans.find((value) => String(value.id) === form.planId);
  let endDate = '';
  if (plan && /^\d{4}-\d{2}-\d{2}$/.test(form.startDate)) { const end = new Date(`${form.startDate}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + Number(plan.durationDays) - 1); if (!Number.isNaN(end.getTime())) endDate = end.toISOString().slice(0, 10); }
  return <div className="panel"><GymNavigation /><p className="eyebrow">GYM OMH</p><h1>{id ? 'Detalle de inscripción' : 'Nueva inscripción'}</h1><ErrorMessage error={error} />{loading ? <p role="status">Cargando inscripción…</p> : id ? item && <><dl className="audit-detail">{[['Socio', `${String(item.memberNumber)} · ${String(item.memberName)}`], ['Membresía', item.planName], ['Inicio', item.startDate], ['Válida hasta', item.endDate], ['Estado', statuses[String(item.status)]], ['Precio registrado', money(item.price)], ['Monto registrado', money(item.amountPaid)], ['Saldo', money(item.balance)], ['Notas', item.notes || 'Sin notas']].map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{String(value)}</dd></div>)}</dl><div className="form-actions"><Link to="/gym/enrollments">Volver</Link>{can('enrollments.write') && item.status !== 'cancelled' && <button disabled={saving} onClick={() => void cancel()}>{saving ? 'Cancelando…' : 'Cancelar inscripción'}</button>}</div></> : <form className="product-form" onSubmit={(event) => void submit(event)}>{(!members.length || !plans.length) && <p className="muted">Primero registra al menos un socio activo y una membresía disponible.</p>}<label>Socio<select required value={form.memberId} onChange={(event) => setForm((current) => ({ ...current, memberId: event.target.value }))}><option value="">Selecciona un socio</option>{members.map((member) => <option key={String(member.id)} value={String(member.id)}>{String(member.memberNumber)} · {String(member.name)}</option>)}</select></label><label>Membresía<select required value={form.planId} onChange={(event) => { const selected = plans.find((plan) => String(plan.id) === event.target.value); setForm((current) => ({ ...current, planId: event.target.value, amountPaid: selected ? String(selected.price) : '' })); }}><option value="">Selecciona una membresía</option>{plans.map((plan) => <option key={String(plan.id)} value={String(plan.id)}>{String(plan.name)} · {String(plan.durationDays)} días · {money(plan.price)}</option>)}</select></label><label>Fecha de inicio<input type="date" required value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} /></label>{endDate && <p className="muted">Válida hasta el {endDate}, incluido. La API confirma la vigencia al guardar.</p>}<label>Monto recibido y registrado (MXN)<input type="number" min="0" max={plan ? Number(plan.price) : 1000000} step="0.01" required value={form.amountPaid} onChange={(event) => setForm((current) => ({ ...current, amountPaid: event.target.value }))} /></label><label>Notas administrativas<textarea maxLength={500} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label><small className="muted">Este registro documenta un pago recibido fuera del sistema. No realiza cobros en línea.</small><div className="form-actions"><Link to={can('enrollments.read') ? '/gym/enrollments' : getLandingPath(user?.permissions ?? [])}>Volver</Link><button className="primary" disabled={saving || !members.length || !plans.length}>{saving ? 'Registrando…' : 'Registrar inscripción'}</button></div></form>}</div>;
}
