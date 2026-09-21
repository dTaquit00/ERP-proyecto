import type { RequestHandler } from 'express';
import type { Permission } from '@erp/types';
import { AuthError, ForbiddenError } from '../http/errors.js';

/**
 * Autorización RBAC: exige que el usuario autenticado tenga TODOS los permisos indicados.
 * Es la contraparte backend de los botones del frontend: el backend siempre verifica.
 */
export function authorize(...requiredPermissions: Permission[]): RequestHandler {
  return (req, _res, next) => {
    const auth = req.auth;
    if (!auth) {
      next(new AuthError('Se requiere autenticación', 'MISSING_TOKEN'));
      return;
    }
    const missing = requiredPermissions.filter(
      (permission) => !auth.permissions.includes(permission),
    );
    if (missing.length > 0) {
      next(new ForbiddenError('No tienes permisos para realizar esta operación', 'INSUFFICIENT_PERMISSIONS'));
      return;
    }
    next();
  };
}
