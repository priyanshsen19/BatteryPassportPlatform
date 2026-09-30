import { appendFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { Logger } from '@bpp/shared';
import type { Notification, Notifier } from './notification';

/**
 * Mock email channel: appends each notification to a plain-text file, formatted like an email,
 * so notifications can be read without an SMTP server.
 */
export class FileNotifier implements Notifier {
  readonly channel = 'file';

  constructor(
    private readonly filePath: string,
    private readonly logger: Logger,
  ) {}

  async send({ subject, message, event }: Notification): Promise<void> {
    const entry = [
      `Date: ${event.timestamp}`,
      `Subject: ${subject}`,
      '',
      message,
      `Event: ${event.eventType} (${event.eventId})`,
      '-'.repeat(60),
      '',
    ].join('\n');
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, entry, 'utf8');
    this.logger.debug('Notification written to file', { eventId: event.eventId, file: this.filePath });
  }
}
