import { commonEnvSchema, createLogger, loadEnv, parseCorsOrigins } from '@bpp/shared';
import type { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';

const envSchema = commonEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(4001),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  // Optional: Google sign-in is disabled when no OAuth client id is configured.
  GOOGLE_CLIENT_ID: z.string().optional(),
});

const env = loadEnv(envSchema);

export const config = {
  serviceName: 'auth-service',
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  mongoUri: env.MONGODB_URI,
  corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<SignOptions['expiresIn']>,
    issuer: 'bpp-auth-service',
    audience: 'bpp-services',
  },
  bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
  google: { clientId: env.GOOGLE_CLIENT_ID || undefined },
} as const;

export const logger = createLogger(config.serviceName, {
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === 'development',
  silent: env.NODE_ENV === 'test',
});
