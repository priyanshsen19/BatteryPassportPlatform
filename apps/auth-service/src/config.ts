import { booleanString, commonEnvSchema, createLogger, loadEnv, parseCorsOrigins } from '@bpp/shared';
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
  // Optional: creates (or promotes) the first administrator at startup.
  BOOTSTRAP_ADMIN_EMAIL: z.string().trim().toLowerCase().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),
  // Password reset: links point at the web app; emails are sent when SMTP_HOST is set.
  PUBLIC_APP_URL: z.string().trim().default('http://localhost:3000'),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanString(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('BatteryPass <no-reply@battery-passport.local>'),
});

const env = loadEnv(envSchema);

/** Accepts `bpp-web.onrender.com` or a full URL and returns its origin. */
function normalizeAppUrl(value: string): string {
  return new URL(/^https?:\/\//.test(value) ? value : `https://${value}`).origin;
}

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
  bootstrapAdmin: {
    email: env.BOOTSTRAP_ADMIN_EMAIL || undefined,
    password: env.BOOTSTRAP_ADMIN_PASSWORD || undefined,
  },
  passwordReset: {
    appUrl: normalizeAppUrl(env.PUBLIC_APP_URL),
    ttlMinutes: env.PASSWORD_RESET_TTL_MINUTES,
  },
  smtp: env.SMTP_HOST
    ? {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth:
          env.SMTP_USER && env.SMTP_PASSWORD ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
        from: env.SMTP_FROM,
      }
    : undefined,
} as const;

export const logger = createLogger(config.serviceName, {
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === 'development',
  silent: env.NODE_ENV === 'test',
});
