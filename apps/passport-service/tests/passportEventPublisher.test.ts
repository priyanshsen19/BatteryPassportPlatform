import { PASSPORT_EVENTS_TOPIC, createLogger, passportEventSchema } from '@bpp/shared';
import type { Kafka } from 'kafkajs';
import { KafkaPassportEventPublisher } from '../src/events/passportEventPublisher';

function createFakeKafka() {
  const producer = {
    events: { CONNECT: 'producer.connect', DISCONNECT: 'producer.disconnect' },
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue([]),
  };
  const admin = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    createTopics: jest.fn().mockResolvedValue(true),
  };
  const kafka = { producer: jest.fn(() => producer), admin: jest.fn(() => admin) };
  return { kafka: kafka as unknown as Kafka, producer, admin };
}

const logger = createLogger('test', { silent: true });

describe('KafkaPassportEventPublisher', () => {
  it('creates the topic before connecting the producer', async () => {
    const { kafka, producer, admin } = createFakeKafka();
    await new KafkaPassportEventPublisher(kafka, logger).connect();

    expect(admin.createTopics).toHaveBeenCalledWith(
      expect.objectContaining({ topics: [expect.objectContaining({ topic: PASSPORT_EVENTS_TOPIC })] }),
    );
    expect(producer.connect).toHaveBeenCalled();
  });

  it.each(['passport.created', 'passport.updated', 'passport.deleted'] as const)(
    'publishes %s with the passport id as message key and a valid payload',
    async (eventType) => {
      const { kafka, producer } = createFakeKafka();
      const publisher = new KafkaPassportEventPublisher(kafka, logger);

      await publisher.publish(eventType, 'passport-42', 'req-1');

      expect(producer.send).toHaveBeenCalledTimes(1);
      const record = producer.send.mock.calls[0][0];
      expect(record.topic).toBe(PASSPORT_EVENTS_TOPIC);
      expect(record.messages[0].key).toBe('passport-42');
      expect(record.messages[0].headers).toMatchObject({ eventType, 'x-request-id': 'req-1' });

      const payload = passportEventSchema.parse(JSON.parse(record.messages[0].value));
      expect(payload).toMatchObject({ eventType, version: 1, data: { passportId: 'passport-42' } });
    },
  );

  it('propagates producer errors to the caller', async () => {
    const { kafka, producer } = createFakeKafka();
    producer.send.mockRejectedValueOnce(new Error('broker down'));
    await expect(
      new KafkaPassportEventPublisher(kafka, logger).publish('passport.created', 'p1'),
    ).rejects.toThrow('broker down');
  });
});
