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

async function main(): Promise<void> {
  await connectMongo(config.mongoUri, logger);
  await ensureBootstrapAdmin();
  const server = await startHttpServer(createApp(), config.port, logger);
  registerGracefulShutdown(logger, [() => closeServer(server), disconnectMongo]);
}

main().catch((err: Error) => {
  logger.error('Failed to start auth-service', { error: err.message, stack: err.stack });
  process.exit(1);
});
