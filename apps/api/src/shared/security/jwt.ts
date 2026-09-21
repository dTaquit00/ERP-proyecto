import { sign, verify as verifyJwt, TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import type { AccessTokenPayload } from '@erp/types';
import { env } from '../../config/env.js';
import { AuthError } from '../http/errors.js';

/** Firma un access token de corta duración ligado a la sesión. */
export function signAccessToken(
  payload: AccessTokenPayload,
  expiresIn: number = env.JWT_ACCESS_TTL_SECONDS,
): string {
  return sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn,
  });
}

/** Verifica un access token y devuelve su payload tipado o lanza AuthError (401). */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = verifyJwt(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    });
    if (typeof decoded === 'string' || decoded.typ !== 'access') {
      throw new AuthError('Token no válido', 'TOKEN_INVALID');
    }
    const payload = decoded as Partial<AccessTokenPayload>;
    if (!payload.sub || !payload.companyId || !payload.roleId || !payload.sid) {
      throw new AuthError('Token no válido', 'TOKEN_INVALID');
    }
    return payload as AccessTokenPayload;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    if (error instanceof TokenExpiredError) {
      throw new AuthError('La sesión ha expirado', 'TOKEN_EXPIRED');
    }
    if (error instanceof JsonWebTokenError) {
      throw new AuthError('Token no válido', 'TOKEN_INVALID');
    }
    throw new AuthError('Token no válido', 'TOKEN_INVALID');
  }
}
