import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import type { Logger } from '../logger';
import { createErrorHandler, notFoundHandler } from './errorHandler';
import { requestId, requestLogger } from './requestContext';

export type DependencyStatus = 'up' | 'down' | 'disabled';

export interface ServiceAppOptions {
  serviceName: string;
  logger: Logger;
  corsOrigins: string[] | '*';
  openApiSpec?: object;
  jsonBodyLimit?: string;
  healthChecks?: () => Record<string, DependencyStatus>;
}

/**
 * Creates an Express app with the middleware every service shares: request ids, request
 * logging, CORS, security headers, JSON body limits, Swagger UI at /docs and GET /health.
 * Call finalizeServiceApp after mounting routes.
 */
export function createServiceApp(options: ServiceAppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId());
  app.use(requestLogger(options.logger));
  app.use(cors({ origin: options.corsOrigins, exposedHeaders: ['x-request-id'] }));

  // Swagger UI is registered before helmet so its bundled assets are not blocked by the CSP.
  const { openApiSpec } = options;
  if (openApiSpec) {
    app.get('/docs.json', (_req, res) => {
      res.json(openApiSpec);
    });
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: options.serviceName }));
  }

  app.use(helmet());
  app.use(express.json({ limit: options.jsonBodyLimit ?? '100kb' }));

  app.get('/health', (_req, res) => {
    const dependencies = options.healthChecks?.() ?? {};
    const healthy = Object.values(dependencies).every((status) => status !== 'down');
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      service: options.serviceName,
      dependencies,
    });
  });

  return app;
}

export function finalizeServiceApp(app: Express, logger: Logger, exposeInternalErrors: boolean): Express {
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger, { exposeInternalErrors }));
  return app;
}
