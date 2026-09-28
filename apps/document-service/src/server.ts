import {
  closeServer,
  connectMongo,
  createAuthServiceClient,
  disconnectMongo,
  registerGracefulShutdown,
  startHttpServer,
} from '@bpp/shared';
import { createApp } from './app';
import { createPassportClient } from './clients/passportClient';
import { config, logger } from './config';
import { S3Storage } from './storage/s3Storage';

async function main(): Promise<void> {
  await connectMongo(config.mongoUri, logger);

  const storage = new S3Storage(config.s3, logger);
  await storage.verifyBucket();

  const app = createApp({
    storage,
    passportClient: createPassportClient({ ...config.passportService, logger }),
    verifyToken: createAuthServiceClient({ ...config.authService, logger }).verifyToken,
  });
  const server = await startHttpServer(app, config.port, logger);

  registerGracefulShutdown(logger, [() => closeServer(server), disconnectMongo]);
}

main().catch((err: Error) => {
  logger.error('Failed to start document-service', { error: err.message, stack: err.stack });
  process.exit(1);
});
