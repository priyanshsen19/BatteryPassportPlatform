import {
  closeServer,
  connectMongo,
  createAuthServiceClient,
  createKafkaClient,
  disconnectMongo,
  registerGracefulShutdown,
  startHttpServer,
} from '@bpp/shared';
import { createApp } from './app';
import { config, logger } from './config';
import { KafkaPassportEventPublisher } from './events/passportEventPublisher';
import { seedDemoPassports } from './seed/seed-demo-data';

async function main(): Promise<void> {
  await connectMongo(config.mongoUri, logger);
  if (config.seedDemoData) {
    await seedDemoPassports(logger).catch((err: Error) =>
      logger.error('Seeding demo passports failed', { error: err.message }),
    );
  }

  const publisher = new KafkaPassportEventPublisher(createKafkaClient(config.kafka, logger), logger);
  await publisher.connect();

  const authClient = createAuthServiceClient({ ...config.authService, logger });
  const server = await startHttpServer(
    createApp({ publisher, verifyToken: authClient.verifyToken }),
    config.port,
    logger,
  );

  registerGracefulShutdown(logger, [
    () => closeServer(server),
    () => publisher.disconnect(),
    disconnectMongo,
  ]);
}

main().catch((err: Error) => {
  logger.error('Failed to start passport-service', { error: err.message, stack: err.stack });
  process.exit(1);
});
