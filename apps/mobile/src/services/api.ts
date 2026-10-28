import * as SecureStore from 'expo-secure-store';

const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://erp-proyecto.pages.dev/api/v1';
const API_URL_KEY = 'erp.apiUrl';
const ACCESS_TOKEN_KEY = 'erp.accessToken';

let activeApiUrl: string = DEFAULT_API_URL;
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export async function initApiUrl(): Promise<string> {
  const storedUrl = await SecureStore.getItemAsync(API_URL_KEY).catch(() => null);
  if (storedUrl) {
    activeApiUrl = storedUrl;
  } else {
    activeApiUrl = DEFAULT_API_URL;
  }
  return activeApiUrl;
}

export function getActiveApiUrl(): string {
  return activeApiUrl;
}

export async function setCustomApiUrl(newUrl: string): Promise<void> {
  let formatted = newUrl.trim();
  if (formatted.endsWith('/')) {
    formatted = formatted.slice(0, -1);
  }
  if (!formatted.endsWith('/api/v1') && !formatted.includes('/api/v1')) {
    formatted = `${formatted}/api/v1`;
  }
  activeApiUrl = formatted;
  await SecureStore.setItemAsync(API_URL_KEY, formatted);
}

async function setAccessToken(token: string | null): Promise<void> {
  accessToken = token;
  if (token) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function refresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetchWithTimeout(`${activeApiUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    }, 6000)
      .then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as { data?: { accessToken?: string } };
        return body.data?.accessToken ?? null;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  const token = await refreshPromise;
  await setAccessToken(token);
  return token;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const fullUrl = `${activeApiUrl}${path}`;

  const response = await fetchWithTimeout(fullUrl, {
    ...init,
    headers,
    credentials: 'include',
  }).catch((err) => {
    if (err.name === 'AbortError') {
      throw new Error(`Tiempo de espera agotado al conectar a ${activeApiUrl}.`);
    }
    throw new Error(`No se pudo conectar con el servidor en ${activeApiUrl}. Verifica tu conexión a internet o la URL del servidor.`);
  });

  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refresh()) return api<T>(path, init, false);
  }

  const body = (await response.json().catch(() => ({}))) as {
    data?: T;
    error?: { message?: string; details?: unknown };
  };

  if (!response.ok) {
    throw new Error(body.error?.message ?? `Error HTTP ${response.status}`);
  }

  return body.data as T;
}

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      search.append(key, String(val));
    }
  });
  const queryString = search.toString();
  return queryString ? `?${queryString}` : '';
}

export async function apiGet<T>(endpoint: string, params: Record<string, string | number | boolean | undefined | null> = {}): Promise<T> {
  return api<T>(`${endpoint}${buildQuery(params)}`, { method: 'GET' });
}

export async function apiPost<T>(endpoint: string, body?: unknown): Promise<T> {
  return api<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPatch<T>(endpoint: string, body?: unknown): Promise<T> {
  return api<T>(endpoint, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  return api<T>(endpoint, { method: 'DELETE' });
}

export async function signIn(email: string, password: string, companyId?: string) {
  const result = await api<{ accessToken: string; user: Record<string, unknown> }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password, ...(companyId ? { companyId } : {}) }) },
    false,
  );
  await setAccessToken(result.accessToken);
  return result.user;
}

export async function restoreSession(): Promise<Record<string, unknown>> {
  await initApiUrl();
  const storedToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY).catch(() => null);
  if (!storedToken) {
    throw new Error('No hay sesión guardada');
  }
  accessToken = storedToken;
  try {
    return await api<Record<string, unknown>>('/auth/me', {}, false);
  } catch {
    if (!(await refresh())) throw new Error('La sesión expiró');
    return api<Record<string, unknown>>('/auth/me', {}, false);
  }
}

export async function signOut(): Promise<void> {
  await api('/auth/logout', { method: 'POST' }, false).catch(() => undefined);
  await setAccessToken(null);
}
