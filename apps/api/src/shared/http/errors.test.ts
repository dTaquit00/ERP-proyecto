import { describe, expect, it } from 'vitest';
import {
  AuthError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  TooManyRequestsError,
  ValidationError,
} from './errors.js';

describe('Jerarquía de errores', () => {
  it('ValidationError usa 400 VALIDATION_ERROR y conserva los detalles', () => {
    const error = new ValidationError('Datos inválidos', [
      { path: 'email', message: 'Requerido' },
    ]);
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details?.[0]?.path).toBe('email');
    expect(error.name).toBe('ValidationError');
  });

  it('BadRequestError permite código personalizado', () => {
    const error = new BadRequestError('Token inválido', 'INVALID_RESET_TOKEN');
    expect(error.status).toBe(400);
    expect(error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('AuthError usa 401 con código por defecto UNAUTHORIZED', () => {
    const error = new AuthError('No autenticado');
    expect(error.status).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('ForbiddenError usa 403 con código por defecto FORBIDDEN', () => {
    const error = new ForbiddenError('Sin permisos');
    expect(error.status).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  it('NotFoundError usa 404 con mensaje por defecto', () => {
    const error = new NotFoundError();
    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Recurso no encontrado');
  });

  it('ConflictError usa 409', () => {
    expect(new ConflictError('Duplicado').status).toBe(409);
  });

  it('TooManyRequestsError usa 429 RATE_LIMITED', () => {
    const error = new TooManyRequestsError();
    expect(error.status).toBe(429);
    expect(error.code).toBe('RATE_LIMITED');
  });

  it('InternalError usa 500 y no expone detalles internos', () => {
    const error = new InternalError();
    expect(error.status).toBe(500);
    expect(error.message).toBe('Error interno del servidor');
  });

  it('es instanceof Error para el manejo centralizado', () => {
    expect(new ValidationError()).toBeInstanceOf(Error);
    expect(new InternalError()).toBeInstanceOf(Error);
  });
});
