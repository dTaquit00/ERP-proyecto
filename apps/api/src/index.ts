import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './db/mongoose.js';

async function main(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API escuchando');
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Cerrando servidor');
    const forceExit = setTimeout(() => {
      logger.error('Forzando cierre: el servidor no respondió a tiempo');
      process.exit(1);
    }, 10_000);
    forceExit.unref();
    server.close(() => {
      void disconnectDatabase().finally(() => {
        process.exit(0);
      });
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Error fatal al iniciar la API');
  process.exit(1);
});
