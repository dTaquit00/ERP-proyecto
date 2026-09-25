import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: new URL('../../../../.env', import.meta.url) });

/**
 * Esquema de variables de entorno.
 * La API falla al arrancar si falta algo obligatorio: nunca se operan
 * credenciales parciales ni secretos débiles.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI es obligatoria'),
  // Opcional: resolvers DNS para consultas SRV/TXT de MongoDB cuando la red local no los resuelve.
  MONGODB_DNS_SERVERS: z.string().optional(),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, 'JWT_ACCESS_SECRET debe tener al menos 16 caracteres'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_SECRET debe tener al menos 16 caracteres'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(14),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173,http://localhost:8081'),
  PLATFORM_ADMIN_EMAIL: z.string().email().optional(),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  // Seed (scripts)
  SEED_COMPANY_NAME: z.string().min(1).default('Empresa Demo'),
  SEED_ADMIN_EMAIL: z.string().min(3).default('admin@demo.local'),
  SEED_ADMIN_PASSWORD: z.string().default(''),
}).superRefine((value, context) => {
  if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
    context.addIssue({ code: 'custom', path: ['JWT_REFRESH_SECRET'], message: 'Debe ser distinto de JWT_ACCESS_SECRET' });
  }
  if (value.NODE_ENV === 'production' && value.CORS_ORIGIN.includes('localhost')) {
    context.addIssue({ code: 'custom', path: ['CORS_ORIGIN'], message: 'Producción no puede usar localhost como origen CORS' });
  }
});

export type Env = z.infer<typeof envSchema>;

/** Parsea (y valida) un objeto de entorno tipado. Separado de process.env para poder testearlo. */
export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(env)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Variables de entorno inválidas: ${issues}`);
  }
  return result.data;
}

export const env: Env = parseEnv(process.env);

/** Lista de orígenes CORS permitidos (separados por coma). */
export function corsOrigins(config: Env = env): string[] {
  return config.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
