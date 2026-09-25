import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const ACCESS_TOKEN_KEY = 'erp.accessToken';
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

async function setAccessToken(token: string | null): Promise<void> {
  accessToken = token;
  if (token) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}

async function refresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = await response.json() as { data?: { accessToken?: string } };
        return body.data?.accessToken ?? null;
      })
      .catch(() => null)
      .finally(() => { refreshPromise = null; });
  }
  const token = await refreshPromise;
  await setAccessToken(token);
  return token;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refresh()) return api<T>(path, init, false);
  }
  const body = await response.json().catch(() => ({})) as { data?: T; error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? 'Error de red');
  return body.data as T;
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
  const storedToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (storedToken) accessToken = storedToken;
  try {
    return await api<Record<string, unknown>>('/auth/me', {}, false);
  } catch {
    if (!await refresh()) throw new Error('La sesión expiró');
    return api<Record<string, unknown>>('/auth/me', {}, false);
  }
}

export async function signOut(): Promise<void> {
  await api('/auth/logout', { method: 'POST' }, false).catch(() => undefined);
  await setAccessToken(null);
}
