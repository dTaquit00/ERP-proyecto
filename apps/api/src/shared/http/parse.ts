import type { z } from 'zod';
import type { ErrorDetail } from '@erp/types';
import { ValidationError } from './errors.js';

/**
 * Valida datos de entrada con un schema Zod y lanza ValidationError (400) si falla.
 * Se usa en el límite del controller; el error global lo formatea a `{ error: {...} }`.
 */
export function parseOrThrow<S extends z.ZodType>(
  schema: S,
  data: unknown,
): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details: ErrorDetail[] = result.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.') || '(root)',
      message: issue.message,
      code: issue.code,
    }));
    throw new ValidationError('Los datos proporcionados no son válidos', details);
  }
  return result.data;
}
