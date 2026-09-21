import type { Request } from 'express';
import { AuthError } from './errors.js';
import type { AuthContext } from '../../modules/auth/auth.types.js';

/**
 * Obtiene el contexto de autenticación garantizado.
 * Los routers protegen sus rutas con `authenticate` + `authorize` antes del controller;
 * esta función solo resuelve el tipo opcional de Express.
 */
export function requireAuth(req: Request): AuthContext {
  if (!req.auth) {
    throw new AuthError('Se requiere autenticación', 'MISSING_TOKEN');
  }
  return req.auth;
}
