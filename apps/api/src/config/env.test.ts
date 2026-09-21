import { describe, expect, it } from 'vitest';
import { corsOrigins, parseEnv } from './env.js';

const baseEnv: NodeJS.ProcessEnv = {
  MONGODB_URI: 'mongodb+srv://usuario:clave@cluster.example.mongodb.net/erp',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('parseEnv', () => {
  it('acepta un entorno válido y aplica valores por defecto', () => {
    const config = parseEnv(baseEnv);
    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(3000);
    expect(config.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(config.LOG_LEVEL).toBe('info');
  });

  it('convierte números desde strings (formato .env)', () => {
    const config = parseEnv({ ...baseEnv, PORT: '8080', RATE_LIMIT_MAX: '50' });
    expect(config.PORT).toBe(8080);
    expect(config.RATE_LIMIT_MAX).toBe(50);
  });

  it('rechaza un entorno sin MONGODB_URI', () => {
    const rest: NodeJS.ProcessEnv = { ...baseEnv };
    delete rest.MONGODB_URI;
    expect(() => parseEnv(rest)).toThrow(/MONGODB_URI/);
  });

  it('rechaza secretos demasiado cortos', () => {
    expect(() => parseEnv({ ...baseEnv, JWT_ACCESS_SECRET: 'corto' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
    expect(() => parseEnv({ ...baseEnv, JWT_REFRESH_SECRET: 'corto' })).toThrow(
      /JWT_REFRESH_SECRET/,
    );
  });

  it('rechaza un NODE_ENV desconocido', () => {
    expect(() => parseEnv({ ...baseEnv, NODE_ENV: 'produccion' })).toThrow(/NODE_ENV/);
  });

  it('rechaza un PORT no numérico', () => {
    expect(() => parseEnv({ ...baseEnv, PORT: 'ochenta' })).toThrow(/PORT/);
  });
});

describe('corsOrigins', () => {
  it('separa y limpia los orígenes', () => {
    const config = parseEnv({ ...baseEnv, CORS_ORIGIN: 'http://a.co, http://b.co ,' });
    expect(corsOrigins(config)).toEqual(['http://a.co', 'http://b.co']);
  });
});
