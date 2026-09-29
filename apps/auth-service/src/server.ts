import {
  closeServer,
  connectMongo,
  disconnectMongo,
  registerGracefulShutdown,
  startHttpServer,
} from '@bpp/shared';
import { createApp } from './app';
import { config, logger } from './config';
import { ensureBootstrapAdmin } from './services/bootstrap-admin';
import { mailer } from './services/mailer';

async function main(): Promise<void> {
  await connectMongo(config.mongoUri, logger);
  await ensureBootstrapAdmin();
  const server = await startHttpServer(createApp(), config.port, logger);
  registerGracefulShutdown(logger, [() => closeServer(server), disconnectMongo]);
  // Background check so a misconfigured SMTP server is visible in the logs right after deploy.
  void mailer.verify();
}

main().catch((err: Error) => {
  logger.error('Failed to start auth-service', { error: err.message, stack: err.stack });
  process.exit(1);
});
