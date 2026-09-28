import { commonEnvSchema, createLogger, kafkaEnvSchema, loadEnv, parseCorsOrigins } from '@bpp/shared';
import { z } from 'zod';

const envSchema = commonEnvSchema.extend(kafkaEnvSchema.shape).extend({
  PORT: z.coerce.number().int().positive().default(4002),
  MONGODB_URI: z.string().min(1),
  AUTH_SERVICE_URL: z.url(),
  AUTH_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  KAFKA_CLIENT_ID: z.string().min(1).default('passport-service'),
});

const env = loadEnv(envSchema);

export const config = {
  serviceName: 'passport-service',
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  mongoUri: env.MONGODB_URI,
  corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
  authService: { baseUrl: env.AUTH_SERVICE_URL, timeoutMs: env.AUTH_SERVICE_TIMEOUT_MS },
  kafka: env,
} as const;

export const logger = createLogger(config.serviceName, {
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === 'development',
  silent: env.NODE_ENV === 'test',
});
