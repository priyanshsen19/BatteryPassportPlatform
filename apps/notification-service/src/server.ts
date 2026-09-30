import {
  EmailDelivery,
  brevoProvider,
  closeServer,
  createKafkaClient,
  registerGracefulShutdown,
  smtpProvider,
  startHttpServer,
  type EmailProvider,
} from '@bpp/shared';
import nodemailer from 'nodemailer';
import { createApp } from './app';
import { config, logger } from './config';
import { PassportEventConsumer } from './consumer/passportEventConsumer';
import { PassportEventHandler } from './consumer/passportEventHandler';
import { EmailNotifier } from './notifications/emailNotifier';
import { FileNotifier } from './notifications/fileNotifier';
import { LogNotifier } from './notifications/logNotifier';
import type { Notifier } from './notifications/notification';
import { NotificationDispatcher } from './notifications/notificationDispatcher';

function createEmailDelivery(): EmailDelivery {
  const email = config.email;
  const providers: EmailProvider[] = [];
  if (email?.smtp) {
    providers.push(
      smtpProvider(
        nodemailer.createTransport({
          ...email.smtp,
          // Fail within seconds rather than Nodemailer's default of two minutes, so an
          // unreachable SMTP server cannot hold up the events queued behind it.
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
        }),
      ),
    );
  }
  if (email?.brevoApiKey) providers.push(brevoProvider(email.brevoApiKey));
  return new EmailDelivery(providers, logger);
}

function createNotifiers(delivery: EmailDelivery): Notifier[] {
  const notifiers: Notifier[] = [new LogNotifier(logger)];
  if (config.notificationFile) notifiers.push(new FileNotifier(config.notificationFile, logger));

  if (config.email && delivery.enabled) {
    notifiers.push(new EmailNotifier(delivery, { from: config.email.from, to: config.email.to }, logger));
    // Checked in the background so a slow provider never delays consuming events.
    void delivery.verify();
  } else if (config.emailMissing) {
    logger.warn(`Email is configured but ${config.emailMissing} is empty: email notifications are off`);
  }

  logger.info('Notification channels configured', { channels: notifiers.map((n) => n.channel) });
  return notifiers;
}

async function main(): Promise<void> {
  const delivery = createEmailDelivery();
  const handler = new PassportEventHandler(
    new NotificationDispatcher(createNotifiers(delivery), logger),
    logger,
  );
  const consumer = new PassportEventConsumer(
    createKafkaClient(config.kafka, logger),
    config.kafkaGroupId,
    handler,
    logger,
  );

  await consumer.start();
  const server = await startHttpServer(
    createApp(
      () => consumer.isConnected(),
      () => delivery.health(),
    ),
    config.port,
    logger,
  );

  registerGracefulShutdown(logger, [() => closeServer(server), () => consumer.stop()]);
}

main().catch((err: Error) => {
  logger.error('Failed to start notification-service', { error: err.message, stack: err.stack });
  process.exit(1);
});
