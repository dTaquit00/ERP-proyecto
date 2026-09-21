import type { Permission } from './permissions.js';

/** Usuario autenticado tal como lo devuelve la API (nunca incluye hash de contraseña). */
export interface AuthUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyId: string;
  roleId: string;
  roleName: string;
  permissions: Permission[];
  isActive: boolean;
}

/** Cuerpo de la respuesta de login / refresh. */
export interface LoginResponse {
  user: AuthUserResponse;
  accessToken: string;
  expiresIn: number;
}

/** Payload del access token JWT. */
export interface AccessTokenPayload {
  /** Identificador del usuario. */
  sub: string;
  /** Empresa a la que pertenece el usuario (aislamiento multiempresa). */
  companyId: string;
  /** Rol del usuario. */
  roleId: string;
  /** Sesión (refresh) a la que está ligado el token. */
  sid: string;
  /** Tipo de token: rechaza cualquier otro uso del access token. */
  typ: 'access';
}
