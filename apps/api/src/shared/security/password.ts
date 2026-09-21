import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { logger } from '../../config/logger.js';

/**
 * Hash de contraseñas con scrypt (nativo de Node, sin dependencias externas).
 * Formato: `scrypt$N$r$p$salt(base64)$hash(base64)` — el coste queda embebido
 * para poder verificar hashes históricos si cambian los parámetros.
 *
 * Nunca se guarda ni se registra la contraseña en texto plano.
 */
const SCRYPT = { N: 16_384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(plain, salt, KEY_LENGTH, SCRYPT);
  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  if (!nRaw || !rRaw || !pRaw || !saltRaw || !hashRaw) return false;

  const expected = Buffer.from(hashRaw, 'base64');
  if (expected.length === 0) return false;

  try {
    const derived = await scryptAsync(plain, Buffer.from(saltRaw, 'base64'), expected.length, {
      N: Number(nRaw),
      r: Number(rRaw),
      p: Number(pRaw),
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Hash ficticio para equalizar el tiempo de respuesta cuando el correo no existe
 * (protección contra enumeración de usuarios).
 */
let dummyHashPromise: Promise<string> | null = null;
export function getDummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHashPromise;
}

/** Solo para diagnóstico del seed: detecta hashes no soportados sin fallar en runtime. */
export function isSupportedPasswordHash(stored: string): boolean {
  const ok = stored.startsWith('scrypt$');
  if (!ok) {
    logger.warn('Formato de hash de contraseña no soportado detectado');
  }
  return ok;
}
