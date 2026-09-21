import { describe, expect, it } from 'vitest';
import { sign } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AuthError } from '../http/errors.js';
import { signAccessToken, verifyAccessToken } from './jwt.js';

const payload = {
  sub: 'user-1',
  companyId: 'company-1',
  roleId: 'role-1',
  sid: 'session-1',
  typ: 'access',
} as const;

describe('signAccessToken / verifyAccessToken', () => {
  it('firma y verifica un token conservando el payload', () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('user-1');
    expect(decoded.companyId).toBe('company-1');
    expect(decoded.typ).toBe('access');
  });

  it('rechaza un token firmado con otro secreto', () => {
    const forged = sign(payload, 'otro-secreto-completamente-distinto', { algorithm: 'HS256' });
    expect(() => verifyAccessToken(forged)).toThrow(AuthError);
  });

  it('distingue token expirado (TOKEN_EXPIRED) de token inválido (TOKEN_INVALID)', () => {
    const expired = sign(payload, env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      expiresIn: -10,
    });
    try {
      verifyAccessToken(expired);
      expect.unreachable('Debió lanzar AuthError');
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).code).toBe('TOKEN_EXPIRED');
    }

    try {
      verifyAccessToken('basura-no-token');
      expect.unreachable('Debió lanzar AuthError');
    } catch (error) {
      expect((error as AuthError).code).toBe('TOKEN_INVALID');
    }
  });

  it('rechaza un token con typ diferente a access', () => {
    const wrongType = sign({ ...payload, typ: 'refresh' }, env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      expiresIn: 60,
    });
    expect(() => verifyAccessToken(wrongType)).toThrow(AuthError);
  });

  it('rechaza un token con campos obligatorios ausentes', () => {
    const incomplete = sign({ sub: 'solo-sub', typ: 'access' }, env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      expiresIn: 60,
    });
    expect(() => verifyAccessToken(incomplete)).toThrow(AuthError);
  });
});
