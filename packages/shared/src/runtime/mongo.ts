import mongoose from 'mongoose';
import type { Logger } from '../logger';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Connects to MongoDB, retrying while the database is still starting (e.g. in Docker Compose). */
export async function connectMongo(uri: string, logger: Logger, retries = 10, delayMs = 3000): Promise<void> {
  mongoose.set('strictQuery', true);

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      logger.info('Connected to MongoDB', { database: mongoose.connection.name });
      return;
    } catch (err) {
      logger.warn('MongoDB connection attempt failed', { attempt, retries, error: (err as Error).message });
      if (attempt === retries) throw err;
      await sleep(delayMs);
    }
  }
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
