import { createServiceApp, finalizeServiceApp } from '@bpp/shared';
import type { Express } from 'express';
import { config, logger } from './config';

/** The notification service exposes no public API; the HTTP server exists for health checks. */
export function createApp(
  isConsumerConnected: () => boolean,
  emailHealth: () => Record<string, string> = () => ({ email: 'disabled' }),
): Express {
  const app = createServiceApp({
    serviceName: config.serviceName,
    logger,
    corsOrigins: [],
    healthChecks: () => ({ kafka: isConsumerConnected() ? 'up' : 'down' }),
    // Email is optional, so its state (from the start-up check, then the latest send) is reported
    // without making the service unhealthy.
    healthInfo: emailHealth,
  });
  return finalizeServiceApp(app, logger, false);
}
