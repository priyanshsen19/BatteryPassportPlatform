import { PASSPORT_EVENTS_PARTITIONS, PASSPORT_EVENTS_TOPIC, ensureTopic, type Logger } from '@bpp/shared';
import type { Consumer, Kafka } from 'kafkajs';
import type { PassportEventHandler } from './passportEventHandler';

export class PassportEventConsumer {
  private readonly consumer: Consumer;
  private connected = false;

  constructor(
    private readonly kafka: Kafka,
    groupId: string,
    private readonly handler: PassportEventHandler,
    private readonly logger: Logger,
  ) {
    this.consumer = kafka.consumer({ groupId });
    this.consumer.on(this.consumer.events.CONNECT, () => {
      this.connected = true;
    });
    this.consumer.on(this.consumer.events.DISCONNECT, () => {
      this.connected = false;
    });
    this.consumer.on(this.consumer.events.CRASH, (event) => {
      this.connected = false;
      this.logger.error('Kafka consumer crashed', {
        error: event.payload.error.message,
        restart: event.payload.restart,
      });
    });
  }

  async start(): Promise<void> {
    await ensureTopic(this.kafka, PASSPORT_EVENTS_TOPIC, PASSPORT_EVENTS_PARTITIONS, this.logger);
    await this.consumer.connect();
    // fromBeginning applies only to a brand-new consumer group; afterwards committed offsets win.
    await this.consumer.subscribe({ topics: [PASSPORT_EVENTS_TOPIC], fromBeginning: true });
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        await this.handler.handle(message.value, { topic, partition, offset: message.offset });
      },
    });
    this.logger.info('Kafka consumer started', { topic: PASSPORT_EVENTS_TOPIC });
  }

  isConnected(): boolean {
    return this.connected;
  }

  async stop(): Promise<void> {
    await this.consumer.disconnect();
  }
}
