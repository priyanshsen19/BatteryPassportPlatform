import { booleanString, commonEnvSchema, createLogger, kafkaEnvSchema, loadEnv } from '@bpp/shared';
import { z } from 'zod';

const envSchema = commonEnvSchema.extend(kafkaEnvSchema.shape).extend({
  PORT: z.coerce.number().int().positive().default(4004),
  KAFKA_CLIENT_ID: z.string().min(1).default('notification-service'),
  KAFKA_GROUP_ID: z.string().min(1).default('notification-service'),

  // Email is optional: without SMTP_HOST notifications are only written to the structured log.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanString(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('Battery Passport Platform <no-reply@battery-passport.local>'),
  NOTIFICATION_EMAIL_TO: z.string().optional(),
});

const env = loadEnv(envSchema);

const smtpConfigured = Boolean(env.SMTP_HOST && env.NOTIFICATION_EMAIL_TO);

export const config = {
  serviceName: 'notification-service',
  port: env.PORT,
  kafka: env,
  kafkaGroupId: env.KAFKA_GROUP_ID,
  smtp: smtpConfigured
    ? {
        host: env.SMTP_HOST as string,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth:
          env.SMTP_USER && env.SMTP_PASSWORD ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
        from: env.SMTP_FROM,
        to: env.NOTIFICATION_EMAIL_TO as string,
      }
    : undefined,
} as const;

export const logger = createLogger(config.serviceName, {
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === 'development',
  silent: env.NODE_ENV === 'test',
});
