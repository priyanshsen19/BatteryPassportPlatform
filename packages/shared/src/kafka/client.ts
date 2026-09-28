import { randomUUID } from 'crypto';
import { Kafka, logLevel, type logCreator } from 'kafkajs';
import type { Logger } from '../logger';
import type { PassportEvent, PassportEventType } from '../schemas/events';

export interface KafkaEnv {
  KAFKA_BROKERS: string;
  KAFKA_CLIENT_ID: string;
  KAFKA_SSL: boolean;
  KAFKA_SASL_MECHANISM?: 'plain' | 'scram-sha-256' | 'scram-sha-512';
  KAFKA_SASL_USERNAME?: string;
  KAFKA_SASL_PASSWORD?: string;
}

const WINSTON_LEVELS: Record<number, string> = {
  [logLevel.NOTHING]: 'error',
  [logLevel.ERROR]: 'error',
  [logLevel.WARN]: 'warn',
  [logLevel.INFO]: 'info',
  [logLevel.DEBUG]: 'debug',
};

/** Routes kafkajs' internal logging through Winston so all output is structured the same way. */
const winstonLogCreator =
  (logger: Logger): logCreator =>
  () =>
  ({ namespace, level, log }) => {
    const { message, timestamp: _timestamp, logger: _source, ...extra } = log;
    logger.log(WINSTON_LEVELS[level] ?? 'info', `kafkajs ${namespace}: ${message}`, extra);
  };

/** Builds a KafkaJS client; SSL/SASL options allow hosted, Kafka-compatible providers. */
export function createKafkaClient(env: KafkaEnv, logger: Logger): Kafka {
  const sasl =
    env.KAFKA_SASL_MECHANISM && env.KAFKA_SASL_USERNAME && env.KAFKA_SASL_PASSWORD
      ? {
          mechanism: env.KAFKA_SASL_MECHANISM,
          username: env.KAFKA_SASL_USERNAME,
          password: env.KAFKA_SASL_PASSWORD,
        }
      : undefined;

  return new Kafka({
    clientId: env.KAFKA_CLIENT_ID,
    brokers: env.KAFKA_BROKERS.split(',').map((broker) => broker.trim()),
    ssl: env.KAFKA_SSL,
    // kafkajs' SASL typing is a discriminated union keyed on the mechanism literal
    sasl: sasl as never,
    logLevel: logLevel.WARN,
    logCreator: winstonLogCreator(logger),
    retry: { initialRetryTime: 500, retries: 10 },
  });
}

/**
 * Creates the topic if it does not exist yet (idempotent). Both producer and consumer call it
 * so start-up order does not matter and the partition count is always the intended one.
 */
export async function ensureTopic(kafka: Kafka, topic: string, numPartitions: number, logger: Logger): Promise<void> {
  const admin = kafka.admin();
  await admin.connect();
  try {
    const created = await admin.createTopics({ topics: [{ topic, numPartitions }], waitForLeaders: true });
    if (created) logger.info('Kafka topic created', { topic, numPartitions });
  } finally {
    await admin.disconnect();
  }
}

export const PASSPORT_EVENTS_PARTITIONS = 3;

export function createPassportEvent(eventType: PassportEventType, passportId: string): PassportEvent {
  return {
    eventId: randomUUID(),
    eventType,
    version: 1,
    timestamp: new Date().toISOString(),
    data: { passportId },
  };
}
