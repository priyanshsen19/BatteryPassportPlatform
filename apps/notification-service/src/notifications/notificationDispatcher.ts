import type { Logger, PassportEvent } from '@bpp/shared';
import { buildNotification, type Notifier } from './notification';

/**
 * Fans a notification out to every configured channel. A failing channel (e.g. SMTP down) is
 * logged and does not prevent delivery through the others.
 */
export class NotificationDispatcher {
  constructor(
    private readonly notifiers: Notifier[],
    private readonly logger: Logger,
  ) {}

  async dispatch(event: PassportEvent): Promise<void> {
    const notification = buildNotification(event);

    const results = await Promise.allSettled(this.notifiers.map((notifier) => notifier.send(notification)));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error('Notification channel failed', {
          channel: this.notifiers[index].channel,
          eventId: event.eventId,
          error: (result.reason as Error).message,
        });
      }
    });
  }
}
