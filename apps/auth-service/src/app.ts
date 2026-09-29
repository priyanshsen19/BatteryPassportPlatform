import { createServiceApp, finalizeServiceApp, isMongoConnected } from '@bpp/shared';
import type { Express } from 'express';
import { config, logger } from './config';
import { openApiSpec } from './docs/openapi';
import { createAuthRouter } from './routes/auth.routes';

export function createApp(): Express {
  const app = createServiceApp({
    serviceName: config.serviceName,
    logger,
    corsOrigins: config.corsOrigins,
    openApiSpec,
    healthChecks: () => ({ mongodb: isMongoConnected() ? 'up' : 'down' }),
  });

  app.use('/api/auth', createAuthRouter());

  return finalizeServiceApp(app, logger, !config.isProduction);
}
