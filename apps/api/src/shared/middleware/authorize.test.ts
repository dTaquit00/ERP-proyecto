import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { AuthContext } from '../../modules/auth/auth.types.js';
import { authorize } from './authorize.js';
import { AppError } from '../http/errors.js';

function makeAuth(permissions: AuthContext['permissions']): AuthContext {
  return {
    user: {
      id: 'u1',
      email: 'a@b.co',
      firstName: 'A',
      lastName: 'B',
      companyId: 'c1',
      roleId: 'r1',
      roleName: 'vendedor',
      isActive: true,
    },
    permissions,
    sessionId: 's1',
  };
}

describe('authorize (RBAC)', () => {
  it('llama a next() sin error cuando el usuario tiene el permiso', () => {
    const middleware = authorize('sales.write');
    const req = { auth: makeAuth(['sales.write']) } as Request;
    const next = vi.fn();

    middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('devuelve 403 INSUFFICIENT_PERMISSIONS cuando falta el permiso', () => {
    const middleware = authorize('sales.cancel');
    const req = { auth: makeAuth(['sales.read']) } as Request;
    const next = vi.fn();

    middleware(req, {} as Response, next);

    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(403);
    expect(error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('exige TODOS los permisos indicados', () => {
    const middleware = authorize('sales.write', 'sales.cancel');
    const req = { auth: makeAuth(['sales.write']) } as Request;
    const next = vi.fn();

    middleware(req, {} as Response, next);

    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error.status).toBe(403);
  });

  it('devuelve 401 cuando no hay contexto de autenticación', () => {
    const middleware = authorize('sales.read');
    const req = {} as Request;
    const next = vi.fn();

    middleware(req, {} as Response, next);

    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error.status).toBe(401);
    expect(error.code).toBe('MISSING_TOKEN');
  });
});
