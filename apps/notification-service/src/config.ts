import { booleanString, commonEnvSchema, createLogger, kafkaEnvSchema, loadEnv } from '@bpp/shared';
import { z } from 'zod';
import { recipientsSchema } from './notifications/recipients';

const envSchema = commonEnvSchema.extend(kafkaEnvSchema.shape).extend({
  PORT: z.coerce.number().int().positive().default(4004),
  KAFKA_CLIENT_ID: z.string().min(1).default('notification-service'),
  KAFKA_GROUP_ID: z.string().min(1).default('notification-service'),

  // Email is optional: without SMTP_HOST or BREVO_API_KEY notifications are only logged.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanString(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('Battery Passport Platform <no-reply@battery-passport.local>'),
  // One or more addresses separated by commas; every notification goes to all of them.
  NOTIFICATION_EMAIL_TO: recipientsSchema,
  // Optional: Brevo's HTTPS email API, used when SMTP is not configured or fails (e.g. blocked).
  BREVO_API_KEY: z.string().trim().optional(),
  // Optional mock email: every notification is also appended to this text file.
  NOTIFICATION_FILE: z.string().trim().optional(),
});

const env = loadEnv(envSchema);

const hasProvider = Boolean(env.SMTP_HOST || env.BREVO_API_KEY);
/** Explains why email is off when it looks half-configured. */
const emailMissing =
  hasProvider && env.NOTIFICATION_EMAIL_TO.length === 0 ? 'NOTIFICATION_EMAIL_TO' : undefined;

export const config = {
  serviceName: 'notification-service',
  port: env.PORT,
  kafka: env,
  kafkaGroupId: env.KAFKA_GROUP_ID,
  emailMissing,
  notificationFile: env.NOTIFICATION_FILE || undefined,
  email:
    hasProvider && env.NOTIFICATION_EMAIL_TO.length > 0
      ? {
          from: env.SMTP_FROM,
          to: env.NOTIFICATION_EMAIL_TO,
          smtp: env.SMTP_HOST
            ? {
                host: env.SMTP_HOST,
                port: env.SMTP_PORT,
                secure: env.SMTP_SECURE,
                auth:
                  env.SMTP_USER && env.SMTP_PASSWORD
                    ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
                    : undefined,
              }
            : undefined,
          brevoApiKey: env.BREVO_API_KEY || undefined,
        }
      : undefined,
} as const;

export const logger = createLogger(config.serviceName, {
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === 'development',
  silent: env.NODE_ENV === 'test',
});
