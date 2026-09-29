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

/** `disabled`, `checking`, `up` (SMTP login verified) or `error` (see the log for the reason). */
let emailStatus = 'disabled';

/** Turns common SMTP failures into an actionable hint for the logs. */
function smtpHint(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string };
  if (e.code === 'EAUTH' || e.responseCode === 535) {
    return 'SMTP login rejected: check SMTP_USER/SMTP_PASSWORD (for Gmail, use an App Password)';
  }
  if (e.code === 'ETIMEDOUT' || e.code === 'ECONNECTION' || e.code === 'ESOCKET') {
    return 'SMTP server unreachable: check SMTP_HOST/SMTP_PORT/SMTP_SECURE and that outbound SMTP is allowed';
  }
  return e.message ?? String(err);
}

function createNotifiers(): Notifier[] {
  const notifiers: Notifier[] = [new LogNotifier(logger)];

  if (config.smtp) {
    const { from, to, ...transportOptions } = config.smtp;
    const transporter = nodemailer.createTransport(transportOptions);
    notifiers.push(new EmailNotifier(transporter, { from, to }, logger));

    // Checked in the background so a slow SMTP server never delays consuming events.
    emailStatus = 'checking';
    transporter
      .verify()
      .then(() => {
        emailStatus = 'up';
        logger.info('SMTP connection verified', { host: transportOptions.host, to });
      })
      .catch((err: unknown) => {
        emailStatus = 'error';
        logger.error('SMTP connection check failed', { host: transportOptions.host, hint: smtpHint(err) });
      });
  } else if (config.smtpMissing) {
    logger.warn(`SMTP_HOST is set but ${config.smtpMissing} is empty: email notifications are off`);
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
  const server = await startHttpServer(
    createApp(
      () => consumer.isConnected(),
      () => emailStatus,
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
