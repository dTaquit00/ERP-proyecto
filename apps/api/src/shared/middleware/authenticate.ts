import type { RequestHandler } from 'express';
import type { AuthContext } from '../../modules/auth/auth.types.js';
import { AuthError, ForbiddenError, InternalError } from '../http/errors.js';
import { verifyAccessToken } from '../security/jwt.js';
import { usersRepository } from '../../modules/users/users.repository.js';
import { rolesRepository } from '../../modules/roles/roles.repository.js';
import { isPermission } from '@erp/types';

/**
 * Extrae y valida el Bearer token, carga el usuario y su rol desde la base de datos
 * (los permisos nunca se confían solo en el token: si cambia el rol o se desactiva
 * el usuario, el efecto es inmediato).
 *
 * Express 5 propaga las promesas rechazadas al manejador de errores.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AuthError('Se requiere autenticación', 'MISSING_TOKEN');
    }
    const payload = verifyAccessToken(header.slice(7).trim());

    const user = await usersRepository.findById(payload.sub);
    if (!user) {
      throw new AuthError('La sesión no es válida', 'SESSION_INVALID');
    }
    if (!user.isActive) {
      throw new ForbiddenError('La cuenta está desactivada', 'ACCOUNT_DISABLED');
    }

    const role = await rolesRepository.findByIdInCompany(
      user.companyId.toString(),
      user.roleId.toString(),
    );
    if (!role) {
      throw new InternalError('La configuración de permisos del usuario no existe');
    }

    const auth: AuthContext = {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: user.companyId.toString(),
        roleId: user.roleId.toString(),
        roleName: role.name,
        isActive: user.isActive,
      },
      permissions: role.permissions.filter(isPermission),
      sessionId: payload.sid,
    };
    req.auth = auth;
    next();
  } catch (error) {
    next(error);
  }
};
