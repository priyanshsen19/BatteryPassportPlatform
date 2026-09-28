import { createServiceApp, finalizeServiceApp } from '@bpp/shared';
import type { Express } from 'express';
import { config, logger } from './config';

/** The notification service exposes no public API; the HTTP server exists for health checks. */
export function createApp(isConsumerConnected: () => boolean): Express {
  const app = createServiceApp({
    serviceName: config.serviceName,
    logger,
    corsOrigins: [],
    healthChecks: () => ({ kafka: isConsumerConnected() ? 'up' : 'down' }),
  });
  return finalizeServiceApp(app, logger, false);
}
