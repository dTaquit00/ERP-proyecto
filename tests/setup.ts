/**
 * Entorno de pruebas: se ejecuta antes de cada archivo de test.
 * Los secretos y la URI son ficticios; las integraciones usan mongodb-memory-server.
 */
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/erp-test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789abcdef';
process.env.CORS_ORIGIN ??= 'http://localhost:3000';
// Límites altos para no interferir con las pruebas; el rate limit se prueba aislado.
process.env.RATE_LIMIT_MAX ??= '100000';
process.env.RATE_LIMIT_AUTH_MAX ??= '100000';
