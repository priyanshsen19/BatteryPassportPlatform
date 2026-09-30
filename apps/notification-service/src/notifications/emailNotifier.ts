import type { EmailDelivery, Logger } from '@bpp/shared';
import type { Notification, Notifier } from './notification';

/** Optional channel, enabled when SMTP or Brevo is configured together with recipients. */
export class EmailNotifier implements Notifier {
  readonly channel = 'email';

  constructor(
    private readonly delivery: EmailDelivery,
    private readonly addresses: { from: string; to: string[] },
    private readonly logger: Logger,
  ) {}

  async send({ subject, message, event }: Notification): Promise<void> {
    const { provider, messageId } = await this.delivery.send({
      from: this.addresses.from,
      to: this.addresses.to,
      subject,
      text: [
        message,
        '',
        `Event: ${event.eventType}`,
        `Event ID: ${event.eventId}`,
        `Occurred at: ${event.timestamp}`,
      ].join('\n'),
    });
    this.logger.info('Notification email sent', {
      eventId: event.eventId,
      provider,
      messageId,
      recipients: this.addresses.to.length,
    });
  }
}
