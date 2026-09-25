const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void { accessToken = token; }

async function refresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (response) => response.ok ? (await response.json()).data.accessToken as string : null)
      .catch(() => null)
      .finally(() => { refreshPromise = null; });
  }
  const token = await refreshPromise;
  accessToken = token;
  return token;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    const token = await refresh();
    if (token) return apiRequest<T>(path, init, false);
  }
  const body = await response.json().catch(() => ({})) as { data?: T; error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? 'No se pudo completar la solicitud');
  return body.data as T;
}

export async function login(email: string, password: string, companyId?: string): Promise<{ accessToken: string; user: Record<string, unknown> }> {
  const result = await apiRequest<{ accessToken: string; user: Record<string, unknown> }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, ...(companyId ? { companyId } : {}) }) }, false);
  setAccessToken(result.accessToken);
  return result;
}
export async function logout(): Promise<void> { await apiRequest('/auth/logout', { method: 'POST' }, false).catch(() => undefined); setAccessToken(null); }
export async function bootstrap(): Promise<Record<string, unknown> | null> { const token = await refresh(); if (!token) return null; return apiRequest<Record<string, unknown>>('/auth/me'); }

export async function downloadReport(path: string, retry = true): Promise<{ blob: Blob; filename: string }> {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, { headers, credentials: 'include' });
  if (response.status === 401 && retry) {
    const token = await refresh();
    if (token) return downloadReport(path, false);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? 'No se pudo descargar el reporte');
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? 'reporte.csv';
  return { blob: await response.blob(), filename };
}
