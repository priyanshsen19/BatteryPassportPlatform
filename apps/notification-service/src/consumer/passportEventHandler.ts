import { passportEventSchema, type Logger, type PassportEvent } from '@bpp/shared';

export interface EventDispatcher {
  dispatch(event: PassportEvent): Promise<void>;
}

export interface MessageMeta {
  topic: string;
  partition: number;
  offset: string;
}

const RECENT_EVENT_CAPACITY = 1000;

/**
 * Validates and dispatches one Kafka message. Malformed messages are logged and skipped so a
 * single bad record cannot block the partition; redelivered events (same eventId) are ignored.
 */
export class PassportEventHandler {
  private readonly recentEventIds = new Set<string>();

  constructor(
    private readonly dispatcher: EventDispatcher,
    private readonly logger: Logger,
  ) {}

  async handle(value: Buffer | null, meta: MessageMeta): Promise<'processed' | 'skipped' | 'duplicate'> {
    const event = this.parse(value, meta);
    if (!event) return 'skipped';

    if (this.recentEventIds.has(event.eventId)) {
      this.logger.debug('Duplicate event ignored', { eventId: event.eventId, ...meta });
      return 'duplicate';
    }

    await this.dispatcher.dispatch(event);
    this.remember(event.eventId);
    this.logger.debug('Event processed', { eventId: event.eventId, eventType: event.eventType, ...meta });
    return 'processed';
  }

  private parse(value: Buffer | null, meta: MessageMeta): PassportEvent | null {
    if (!value) {
      this.logger.warn('Skipping empty Kafka message', meta);
      return null;
    }

    let json: unknown;
    try {
      json = JSON.parse(value.toString('utf8'));
    } catch {
      this.logger.warn('Skipping Kafka message that is not valid JSON', meta);
      return null;
    }

    const result = passportEventSchema.safeParse(json);
    if (!result.success) {
      this.logger.warn('Skipping Kafka message that does not match the passport event schema', {
        ...meta,
        issues: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      });
      return null;
    }
    return result.data;
  }

  private remember(eventId: string): void {
    this.recentEventIds.add(eventId);
    if (this.recentEventIds.size > RECENT_EVENT_CAPACITY) {
      const oldest = this.recentEventIds.values().next().value;
      if (oldest) this.recentEventIds.delete(oldest);
    }
  }
}
