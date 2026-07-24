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
} as const;

export type Config = typeof config;
