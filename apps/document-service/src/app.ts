import {
  createAuthenticateJWT,
  createServiceApp,
  finalizeServiceApp,
  isMongoConnected,
  type TokenVerifier,
} from '@bpp/shared';
import type { Express } from 'express';
import type { PassportClient } from './clients/passportClient';
import { config, logger } from './config';
import { createDocumentController } from './controllers/document.controller';
import { openApiSpec } from './docs/openapi';
import { createDocumentRouter } from './routes/document.routes';
import { createDocumentService } from './services/document.service';
import type { ObjectStorage } from './storage/objectStorage';

export interface AppDependencies {
  storage: ObjectStorage;
  passportClient: PassportClient;
  verifyToken: TokenVerifier;
}

export function createApp({ storage, passportClient, verifyToken }: AppDependencies): Express {
  const app = createServiceApp({
    serviceName: config.serviceName,
    logger,
    corsOrigins: config.corsOrigins,
    openApiSpec,
    healthChecks: () => ({
      mongodb: isMongoConnected() ? 'up' : 'down',
      s3: storage.isReady() ? 'up' : 'down',
    }),
  });

  const controller = createDocumentController(createDocumentService(storage, passportClient));
  app.use(
    '/api/documents',
    createDocumentRouter(controller, createAuthenticateJWT(verifyToken), config.maxUploadSizeBytes),
  );

  return finalizeServiceApp(app, logger, !config.isProduction);
}
