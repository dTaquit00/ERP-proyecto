import { createHash, randomBytes } from 'node:crypto';

/** Token opaco de sesión / restablecimiento (no contiene información interna). */
export function generateRandomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * En Base de datos solo se guarda el SHA-256 del token:
 * si la colección se expone, los tokens robados no son utilizables.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
