import { closeServer, createKafkaClient, registerGracefulShutdown, startHttpServer } from '@bpp/shared';
import nodemailer from 'nodemailer';
import { createApp } from './app';
import { config, logger } from './config';
import { PassportEventConsumer } from './consumer/passportEventConsumer';
import { PassportEventHandler } from './consumer/passportEventHandler';
import { EmailNotifier } from './notifications/emailNotifier';
import { LogNotifier } from './notifications/logNotifier';
import type { Notifier } from './notifications/notification';
import { NotificationDispatcher } from './notifications/notificationDispatcher';

function createNotifiers(): Notifier[] {
  const notifiers: Notifier[] = [new LogNotifier(logger)];

  if (config.smtp) {
    const { from, to, ...transportOptions } = config.smtp;
    notifiers.push(new EmailNotifier(nodemailer.createTransport(transportOptions), { from, to }, logger));
  }

  logger.info('Notification channels configured', { channels: notifiers.map((n) => n.channel) });
  return notifiers;
}

async function main(): Promise<void> {
  const handler = new PassportEventHandler(new NotificationDispatcher(createNotifiers(), logger), logger);
  const consumer = new PassportEventConsumer(
    createKafkaClient(config.kafka, logger),
    config.kafkaGroupId,
    handler,
    logger,
  );

  await consumer.start();
  const server = await startHttpServer(createApp(() => consumer.isConnected()), config.port, logger);

  registerGracefulShutdown(logger, [() => closeServer(server), () => consumer.stop()]);
}

main().catch((err: Error) => {
  logger.error('Failed to start notification-service', { error: err.message, stack: err.stack });
  process.exit(1);
});
