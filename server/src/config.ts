import 'dotenv/config';
import { z } from 'zod';

/**
 * Validated, typed application configuration.
 *
 * Env vars are parsed once at startup; an invalid environment fails fast
 * with a readable error instead of surfacing as a mystery bug later.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  JWT_SECRET: z.string().min(1).default('change-me-in-production'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  // Optional: when set, room state and fan-out go through Redis so the server
  // can run as many horizontally-scaled instances. Unset = single-instance
  // in-memory mode, handy for local development.
  REDIS_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  env: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  logLevel: parsed.data.LOG_LEVEL,
  isProduction: parsed.data.NODE_ENV === 'production',
  jwtSecret: parsed.data.JWT_SECRET,
  jwtExpiresIn: parsed.data.JWT_EXPIRES_IN,
  redisUrl: parsed.data.REDIS_URL,
} as const;

if (config.isProduction && config.jwtSecret === 'change-me-in-production') {
  // eslint-disable-next-line no-console
  console.error('JWT_SECRET must be set to a strong value in production');
  process.exit(1);
}

export type Config = typeof config;
