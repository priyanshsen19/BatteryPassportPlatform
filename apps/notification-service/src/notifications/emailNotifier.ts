import type { Logger } from '@bpp/shared';
import type { Transporter } from 'nodemailer';
import type { Notification, Notifier } from './notification';

/** Optional channel, enabled only when SMTP settings are provided. */
export class EmailNotifier implements Notifier {
  readonly channel = 'email';

  constructor(
    private readonly transporter: Transporter,
    private readonly addresses: { from: string; to: string[] },
    private readonly logger: Logger,
  ) {}

  async send({ subject, message, event }: Notification): Promise<void> {
    const info = await this.transporter.sendMail({
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
      messageId: info.messageId,
      recipients: this.addresses.to.length,
    });
  }
}
