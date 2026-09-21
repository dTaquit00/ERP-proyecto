import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import type { ApiErrorBody, ErrorDetail } from '@erp/types';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import {
  AppError,
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
} from './errors.js';

function zodToDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.') || '(root)',
    message: issue.message,
    code: issue.code,
  }));
}

/** Convierte cualquier error capturado en un AppError con código y mensaje apropiados. */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new ValidationError('Los datos proporcionados no son válidos', zodToDetails(error));
  }
  if (error instanceof mongoose.Error.CastError) {
    return new ValidationError('Identificador inválido');
  }
  if (error instanceof mongoose.Error.ValidationError) {
    const details: ErrorDetail[] = Object.values(error.errors).map((item) => ({
      path: item.path,
      message: item.message,
    }));
    return new ValidationError('Los datos proporcionados no son válidos', details);
  }
  // Duplicado (índice único) — cubre también los errores del driver en
  // ejecuciones concurrentes, que no siempre son instancias de MongooseError.
  const maybeDuplicate = error as { code?: unknown } | null;
  if (typeof maybeDuplicate?.code === 'number' && maybeDuplicate.code === 11000) {
    return new ConflictError('El registro ya existe', 'DUPLICATE');
  }
  // Cuerpo JSON malformado (express.json)
  const maybeParseError = error as { type?: string } | null;
  if (maybeParseError?.type === 'entity.parse.failed') {
    return new ValidationError('El cuerpo de la solicitud no es JSON válido');
  }
  if (error instanceof SyntaxError && 'status' in error) {
    return new ValidationError('El cuerpo de la solicitud no es válido');
  }
  return new InternalError();
}

/** 404 para rutas inexistentes bajo /api/v1. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
};

/** Manejador global de errores: respuesta consistente `{ error: { code, message } }`. */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = normalizeError(error);

  if (appError.status >= 500) {
    logger.error(
      { err: error, reqId: req.id, method: req.method, url: req.url },
      appError.message,
    );
  } else {
    logger.warn(
      { code: appError.code, status: appError.status, method: req.method, url: req.url },
      appError.message,
    );
  }

  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
    },
  };
  if (appError.details) body.error.details = appError.details;
  // Nunca exponer stack traces en producción.
  if (appError.status >= 500 && env.NODE_ENV !== 'production' && error instanceof Error) {
    body.error.stack = error.stack;
  }

  res.status(appError.status).json(body);
};
