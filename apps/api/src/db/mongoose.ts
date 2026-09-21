import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export type DatabaseState = 'connected' | 'connecting' | 'disconnecting' | 'disconnected';

const STATE_LABELS: Record<number, DatabaseState> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/** Conecta a MongoDB Atlas (o a cualquier URI compatible). Falla rápido si no hay conexión. */
export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  const connection = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
  });
  logger.info('Conexión a MongoDB establecida');
  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('Conexión a MongoDB cerrada');
}

/** Estado de la conexión para el endpoint de salud y monitoreo. */
export function getDatabaseState(): DatabaseState {
  return STATE_LABELS[mongoose.connection.readyState] ?? 'disconnected';
}
