import { PASSPORT_EVENTS_TOPIC, createLogger, createPassportEvent, type PassportEvent } from '@bpp/shared';
import type { EachMessagePayload, Kafka } from 'kafkajs';
import request from 'supertest';
import { createApp } from '../src/app';
import { PassportEventConsumer } from '../src/consumer/passportEventConsumer';
import { PassportEventHandler, type EventDispatcher } from '../src/consumer/passportEventHandler';

const logger = createLogger('test', { silent: true });
const meta = { topic: PASSPORT_EVENTS_TOPIC, partition: 0, offset: '0' };

class RecordingDispatcher implements EventDispatcher {
  events: PassportEvent[] = [];
  async dispatch(event: PassportEvent) {
    this.events.push(event);
  }
}

const encode = (value: unknown) => Buffer.from(JSON.stringify(value));

describe('PassportEventHandler', () => {
  it.each(['passport.created', 'passport.updated', 'passport.deleted'] as const)(
    'dispatches %s',
    async (type) => {
      const dispatcher = new RecordingDispatcher();
      const event = createPassportEvent(type, 'p-1');

      await expect(new PassportEventHandler(dispatcher, logger).handle(encode(event), meta)).resolves.toBe(
        'processed',
      );
      expect(dispatcher.events).toEqual([event]);
    },
  );

  it('skips messages that are not JSON', async () => {
    const dispatcher = new RecordingDispatcher();
    const result = await new PassportEventHandler(dispatcher, logger).handle(Buffer.from('not json'), meta);
    expect(result).toBe('skipped');
    expect(dispatcher.events).toHaveLength(0);
  });

  it('skips messages that do not match the event schema', async () => {
    const dispatcher = new RecordingDispatcher();
    const handler = new PassportEventHandler(dispatcher, logger);

    const unknownType = { ...createPassportEvent('passport.created', 'p-1'), eventType: 'passport.exploded' };
    const missingData = { ...createPassportEvent('passport.created', 'p-1'), data: {} };

    expect(await handler.handle(encode(unknownType), meta)).toBe('skipped');
    expect(await handler.handle(encode(missingData), meta)).toBe('skipped');
    expect(await handler.handle(null, meta)).toBe('skipped');
    expect(dispatcher.events).toHaveLength(0);
  });

  it('ignores a redelivered event with the same eventId', async () => {
    const dispatcher = new RecordingDispatcher();
    const handler = new PassportEventHandler(dispatcher, logger);
    const event = createPassportEvent('passport.created', 'p-1');

    await handler.handle(encode(event), meta);
    expect(await handler.handle(encode(event), meta)).toBe('duplicate');
    expect(dispatcher.events).toHaveLength(1);
  });
});

describe('PassportEventConsumer', () => {
  function createFakeKafka() {
    let eachMessage: ((payload: EachMessagePayload) => Promise<void>) | undefined;
    const consumer = {
      events: { CONNECT: 'consumer.connect', DISCONNECT: 'consumer.disconnect', CRASH: 'consumer.crash' },
      on: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      run: jest.fn(async (config: { eachMessage: typeof eachMessage }) => {
        eachMessage = config.eachMessage;
      }),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
    const admin = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      createTopics: jest.fn().mockResolvedValue(false),
    };
    const kafka = { consumer: jest.fn(() => consumer), admin: jest.fn(() => admin) } as unknown as Kafka;
    return { kafka, consumer, deliver: (payload: EachMessagePayload) => eachMessage!(payload) };
  }

  it('subscribes to the passport topic and routes messages to the handler', async () => {
    const { kafka, consumer, deliver } = createFakeKafka();
    const dispatcher = new RecordingDispatcher();
    const service = new PassportEventConsumer(
      kafka,
      'notification-service',
      new PassportEventHandler(dispatcher, logger),
      logger,
    );

    await service.start();
    expect(consumer.subscribe).toHaveBeenCalledWith({ topics: [PASSPORT_EVENTS_TOPIC], fromBeginning: true });

    const event = createPassportEvent('passport.deleted', 'p-7');
    await deliver({
      topic: PASSPORT_EVENTS_TOPIC,
      partition: 1,
      message: { value: encode(event), offset: '12' },
    } as unknown as EachMessagePayload);

    expect(dispatcher.events).toEqual([event]);
  });
});

describe('health endpoint', () => {
  it('reports ok while the consumer is connected and 503 otherwise', async () => {
    let connected = true;
    const app = createApp(() => connected);

    const ok = await request(app).get('/health');
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: 'ok', service: 'notification-service' });

    connected = false;
    expect((await request(app).get('/health')).status).toBe(503);
  });

  it('exposes no other routes', async () => {
    expect((await request(createApp(() => true)).get('/api/notifications')).status).toBe(404);
  });
});
