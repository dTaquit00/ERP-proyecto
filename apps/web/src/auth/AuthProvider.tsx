import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiRequest, bootstrap, login as apiLogin, logout as apiLogout } from '../services/api';

type AuthUser = { id: string; email: string; firstName: string; lastName: string; companyId: string; roleName: string; permissions: string[] };
type AuthContextValue = { user: AuthUser | null; loading: boolean; error: string | null; login: (email: string, password: string, companyId?: string) => Promise<void>; logout: () => Promise<void>; can: (permission: string) => boolean };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { bootstrap().then((value) => setUser(value as AuthUser | null)).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  async function login(email: string, password: string, companyId?: string) { setError(null); const result = await apiLogin(email, password, companyId); setUser(result.user as AuthUser); }
  async function logout() { await apiLogout(); setUser(null); }
  return <AuthContext.Provider value={{ user, loading, error, login, logout, can: (permission) => user?.permissions.includes(permission) ?? false }}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextValue { const value = useContext(AuthContext); if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider'); return value; }
export function useResource<T>(path: string) { const [data, setData] = useState<T | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); useEffect(() => { let active = true; setLoading(true); apiRequest<T>(path).then((value) => { if (active) setData(value); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Error de red'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [path]); return { data, loading, error }; }
