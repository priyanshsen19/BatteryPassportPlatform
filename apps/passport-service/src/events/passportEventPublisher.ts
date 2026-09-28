import {
  PASSPORT_EVENTS_PARTITIONS,
  PASSPORT_EVENTS_TOPIC,
  createPassportEvent,
  ensureTopic,
  type Logger,
  type PassportEvent,
  type PassportEventType,
} from '@bpp/shared';
import { Partitioners, type Kafka, type Producer } from 'kafkajs';

export interface PassportEventPublisher {
  publish(eventType: PassportEventType, passportId: string, requestId?: string): Promise<PassportEvent>;
  isConnected(): boolean;
}

export class KafkaPassportEventPublisher implements PassportEventPublisher {
  private readonly producer: Producer;
  private connected = false;

  constructor(
    private readonly kafka: Kafka,
    private readonly logger: Logger,
  ) {
    this.producer = kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
      idempotent: true,
      maxInFlightRequests: 1,
    });
    this.producer.on(this.producer.events.CONNECT, () => {
      this.connected = true;
    });
    this.producer.on(this.producer.events.DISCONNECT, () => {
      this.connected = false;
    });
  }

  async connect(): Promise<void> {
    await ensureTopic(this.kafka, PASSPORT_EVENTS_TOPIC, PASSPORT_EVENTS_PARTITIONS, this.logger);
    await this.producer.connect();
    this.logger.info('Kafka producer connected', { topic: PASSPORT_EVENTS_TOPIC });
  }

  async publish(
    eventType: PassportEventType,
    passportId: string,
    requestId?: string,
  ): Promise<PassportEvent> {
    const event = createPassportEvent(eventType, passportId);

    // Keyed by passportId so all events for one passport land on the same partition, in order.
    await this.producer.send({
      topic: PASSPORT_EVENTS_TOPIC,
      acks: -1,
      messages: [
        {
          key: passportId,
          value: JSON.stringify(event),
          headers: { eventType, ...(requestId ? { 'x-request-id': requestId } : {}) },
        },
      ],
    });

    this.logger.info('Passport event published', {
      eventId: event.eventId,
      eventType,
      passportId,
      requestId,
    });
    return event;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }
}
