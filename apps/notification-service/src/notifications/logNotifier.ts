import type { Logger } from '@bpp/shared';
import type { Notification, Notifier } from './notification';

/** Default channel: writes the notification as a structured log entry. */
export class LogNotifier implements Notifier {
  readonly channel = 'log';

  constructor(private readonly logger: Logger) {}

  async send({ message, event }: Notification): Promise<void> {
    this.logger.info(`[Notification] ${message}`, {
      channel: this.channel,
      eventId: event.eventId,
      eventType: event.eventType,
      passportId: event.data.passportId,
      occurredAt: event.timestamp,
    });
  }
}
