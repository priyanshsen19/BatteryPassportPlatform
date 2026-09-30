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
    /** Told whether each send worked, so /health reflects the latest attempt. */
    private readonly onResult: (ok: boolean) => void = () => undefined,
  ) {}

  async send(notification: Notification): Promise<void> {
    try {
      await this.deliver(notification);
      this.onResult(true);
    } catch (err) {
      this.onResult(false);
      throw err;
    }
  }

  private async deliver({ subject, message, event }: Notification): Promise<void> {
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
