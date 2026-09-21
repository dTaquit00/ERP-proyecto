import type { ErrorDetail } from '@erp/types';

export type { ErrorDetail };

/**
 * Jerarquía de errores de aplicación.
 * Cada error define código HTTP + código de negocio estable para el cliente.
 * Los mensajes son aptos para el usuario final (sin stack traces ni detalles internos).
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetail[];

  constructor(status: number, code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    if (details) this.details = details;
  }
}

/** 400 — datos de entrada inválidos (validación). */
export class ValidationError extends AppError {
  constructor(message = 'Los datos proporcionados no son válidos', details?: ErrorDetail[]) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

/** 400 — regla de negocio que impide procesar la solicitud. */
export class BadRequestError extends AppError {
  constructor(message: string, code = 'BAD_REQUEST') {
    super(400, code, message);
  }
}

/** 401 — fallos de autenticación (credenciales, token, sesión). */
export class AuthError extends AppError {
  constructor(message: string, code = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}

/** 403 — autenticado pero sin permiso (RBAC / cuenta desactivada). */
export class ForbiddenError extends AppError {
  constructor(message: string, code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

/** 404 — recurso inexistente. */
export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

/** 409 — conflicto (duplicados, estado incompatible). */
export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT') {
    super(409, code, message);
  }
}

/** 429 — límite de solicitudes superado. */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Demasiadas solicitudes. Intenta de nuevo más tarde.', code = 'RATE_LIMITED') {
    super(429, code, message);
  }
}

/** 500 — error interno (el detalle real solo va al log). */
export class InternalError extends AppError {
  constructor(message = 'Error interno del servidor', code = 'INTERNAL_ERROR') {
    super(500, code, message);
  }
}
