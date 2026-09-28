import {
  createAuthenticateJWT,
  createServiceApp,
  finalizeServiceApp,
  isMongoConnected,
  type TokenVerifier,
} from '@bpp/shared';
import type { Express } from 'express';
import { config, logger } from './config';
import { createPassportController } from './controllers/passport.controller';
import { openApiSpec } from './docs/openapi';
import type { PassportEventPublisher } from './events/passportEventPublisher';
import { createPassportRouter } from './routes/passport.routes';
import { createPassportService } from './services/passport.service';

export interface AppDependencies {
  publisher: PassportEventPublisher;
  verifyToken: TokenVerifier;
}

export function createApp({ publisher, verifyToken }: AppDependencies): Express {
  const app = createServiceApp({
    serviceName: config.serviceName,
    logger,
    corsOrigins: config.corsOrigins,
    openApiSpec,
    jsonBodyLimit: '256kb',
    healthChecks: () => ({
      mongodb: isMongoConnected() ? 'up' : 'down',
      kafka: publisher.isConnected() ? 'up' : 'down',
    }),
  });

  const controller = createPassportController(createPassportService(publisher));
  app.use('/api/passports', createPassportRouter(controller, createAuthenticateJWT(verifyToken)));

  return finalizeServiceApp(app, logger, !config.isProduction);
}
