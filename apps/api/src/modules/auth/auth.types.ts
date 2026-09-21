import type { AuthUserResponse, Permission } from '@erp/types';

/** Contexto de autenticación inyectado por el middleware `authenticate`. */
export interface AuthContext {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    companyId: string;
    roleId: string;
    roleName: string;
    isActive: boolean;
  };
  permissions: Permission[];
  sessionId: string;
}

/** Datos de la petición relevantes para trazabilidad de sesiones. */
export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

/** Resultado de login / refresh. */
export interface AuthResult {
  user: AuthUserResponse;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}
