import mongoose, { type ClientSession } from 'mongoose';
import { logger } from '../../config/logger.js';
import { AppError } from '../http/errors.js';

/**
 * Ejecuta `fn` dentro de una transacción multi-documento de MongoDB
 * (Fase 11+): el callback puede leer/escribir varias colecciones y TODO se
 * confirma o revierte de forma atómica. Si `fn` lanza, el driver aborta la
 * transacción y repropaga el error original (p. ej. INSUFFICIENT_STOCK).
 *
 * Requisito: la base debe operar como replica set (MongoDB Atlas lo es;
 * una instancia local "stand-alone" devolvería código 20 IllegalOperation,
 * que aquí se traduce a un error de aplicación claro en lugar de un 500 opaco).
 */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => fn(session));
  } catch (error) {
    const mongoError = error as { code?: number; codeName?: string };
    if (mongoError.code === 20 || mongoError.codeName === 'IllegalOperation') {
      logger.error({ err: error }, 'MongoDB no admite transacciones: se requiere replica set');
      throw new AppError(
        500,
        'TRANSACTIONS_REQUIRED',
        'La operación multi-documento requiere MongoDB en modo replica set',
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
