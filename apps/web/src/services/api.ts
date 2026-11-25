// En producción, Pages reenvía /api/* a Render mediante la Pages Function.
// Mantiene el mismo origen para evitar CORS y no caer en localhost si falta env.
const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let onAuthenticationExpired: (() => void) | null = null;

export class ApiError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) {
    super(message);
  }
}

type ApiBody<T> = {
  data?: T;
  error?: { message?: string; code?: string; details?: Array<{ message?: string }> };
};

async function fetchApi(path: string, init: RequestInit): Promise<Response> {
  const timeout = AbortSignal.timeout(65_000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  try {
    return await fetch(`${API_URL}${path}`, { ...init, signal, credentials: 'include' });
  } catch (reason) {
    if (init.signal?.aborted) throw reason;
    throw new ApiError(timeout.aborted
      ? 'El servidor tardó demasiado en responder. Vuelve a intentarlo en unos minutos.'
      : 'No pudimos conectar con el servidor. Vuelve a intentarlo.');
  }
}

async function readBody<T>(response: Response): Promise<ApiBody<T> | null> {
  const body: unknown = await response.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body) ? body as ApiBody<T> : null;
}

function responseError(response: Response, body: ApiBody<unknown> | null): ApiError {
  if (response.status === 429) {
    const infrastructure = response.headers.get('x-render-routing') === 'hibernate-rate-limited'
      || response.headers.get('cf-mitigated') === 'challenge';
    return new ApiError(infrastructure
      ? 'El servidor está temporalmente limitado por el proveedor de alojamiento. Intenta de nuevo más tarde.'
      : 'Demasiadas solicitudes. Espera unos minutos antes de volver a intentarlo.',
    body?.error?.code ?? 'RATE_LIMITED', response.status);
  }
  const fallback = response.status >= 500
    ? 'El servidor no está disponible en este momento. Vuelve a intentarlo en unos minutos.'
    : 'No se pudo completar la solicitud';
  const details = body?.error?.details?.map((detail) => detail.message).filter(Boolean);
  const message = details?.length
    ? `${body?.error?.message ?? fallback}: ${[...new Set(details)].join('. ')}`
    : body?.error?.message ?? fallback;
  return new ApiError(message, body?.error?.code, response.status);
}

export function setAccessToken(token: string | null): void { accessToken = token; }
export function setAuthenticationExpiredHandler(handler: (() => void) | null): void { onAuthenticationExpired = handler; }

async function refresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = apiRequest<{ accessToken: string }>('/auth/refresh', { method: 'POST' }, false)
      .then((result) => {
        if (typeof result?.accessToken !== 'string' || !result.accessToken) {
          throw new ApiError('El servidor devolvió una sesión inesperada. Vuelve a iniciar sesión.');
        }
        return result.accessToken;
      })
      .catch((reason: unknown) => {
        if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) return null;
        throw reason;
      })
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
  const response = await fetchApi(path, { ...init, headers });
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    const token = await refresh();
    if (token) return apiRequest<T>(path, init, false);
  }
  if (response.status === 401 && !path.startsWith('/auth/')) {
    accessToken = null;
    onAuthenticationExpired?.();
  }
  const body = await readBody<T>(response);
  if (!response.ok) throw responseError(response, body);
  if (!body || !Object.hasOwn(body, 'data')) throw new ApiError('El servidor devolvió una respuesta inesperada. Vuelve a intentarlo.');
  return body.data as T;
}

/** Carga todas las páginas de un endpoint paginado para selectores de referencia. */
export async function apiListAll<T>(path: string, pageSize = 100): Promise<{ items: T[]; meta?: { total: number; totalPages: number } }> {
  const [endpoint, queryString = ''] = path.split('?', 2);
  const params = new URLSearchParams(queryString);
  const limit = Math.min(Math.max(1, pageSize), 100);
  params.set('limit', String(limit));
  params.set('page', '1');
  const firstPage = await apiRequest<{ items?: T[]; meta?: { totalPages?: number } }>(`${endpoint}?${params}`);
  const items = [...(firstPage.items ?? [])];
  const totalPages = Math.max(1, Number(firstPage.meta?.totalPages ?? 1));
  for (let page = 2; page <= totalPages; page += 1) {
    params.set('page', String(page));
    const nextPage = await apiRequest<{ items?: T[] }>(`${endpoint}?${params}`);
    items.push(...(nextPage.items ?? []));
  }
  return { items, meta: firstPage.meta as { total: number; totalPages: number } | undefined };
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
  const response = await fetchApi(path, { headers });
  if (response.status === 401 && retry) {
    const token = await refresh();
    if (token) return downloadReport(path, false);
  }
  if (response.status === 401) {
    accessToken = null;
    onAuthenticationExpired?.();
  }
  if (!response.ok) {
    throw responseError(response, await readBody(response));
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? 'reporte.csv';
  return { blob: await response.blob(), filename };
}
