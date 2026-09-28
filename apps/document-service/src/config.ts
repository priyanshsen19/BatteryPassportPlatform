import {
  MAX_DOCUMENT_SIZE_BYTES,
  booleanString,
  commonEnvSchema,
  createLogger,
  loadEnv,
  parseCorsOrigins,
} from '@bpp/shared';
import { z } from 'zod';

const envSchema = commonEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(4003),
  MONGODB_URI: z.string().min(1),
  AUTH_SERVICE_URL: z.url(),
  PASSPORT_SERVICE_URL: z.url(),
  SERVICE_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  AWS_REGION: z.string().min(1),
  AWS_S3_BUCKET: z.string().min(3),
  // Optional: when unset the SDK's default credential chain is used (e.g. an IAM role).
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  // Only for S3-compatible local development (LocalStack). Leave unset for AWS S3.
  AWS_S3_ENDPOINT: z.url().optional(),
  // Endpoint used when signing download URLs, when clients reach S3 through a different
  // host than the service does (e.g. localhost:4566 vs localstack:4566 inside Docker).
  AWS_S3_PUBLIC_ENDPOINT: z.url().optional(),
  AWS_S3_FORCE_PATH_STYLE: booleanString(false),

  DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  MAX_UPLOAD_SIZE_BYTES: z.coerce.number().int().positive().default(MAX_DOCUMENT_SIZE_BYTES),
});

const env = loadEnv(envSchema);

export const config = {
  serviceName: 'document-service',
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  mongoUri: env.MONGODB_URI,
  corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
  authService: { baseUrl: env.AUTH_SERVICE_URL, timeoutMs: env.SERVICE_REQUEST_TIMEOUT_MS },
  passportService: { baseUrl: env.PASSPORT_SERVICE_URL, timeoutMs: env.SERVICE_REQUEST_TIMEOUT_MS },
  s3: {
    region: env.AWS_REGION,
    bucket: env.AWS_S3_BUCKET,
    credentials:
      env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
        : undefined,
    endpoint: env.AWS_S3_ENDPOINT,
    publicEndpoint: env.AWS_S3_PUBLIC_ENDPOINT,
    forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
    downloadUrlTtlSeconds: env.DOWNLOAD_URL_TTL_SECONDS,
  },
  maxUploadSizeBytes: env.MAX_UPLOAD_SIZE_BYTES,
} as const;

export const logger = createLogger(config.serviceName, {
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === 'development',
  silent: env.NODE_ENV === 'test',
});
