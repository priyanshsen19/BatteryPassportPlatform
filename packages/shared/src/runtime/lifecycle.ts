import type { Server } from 'http';
import type { Express } from 'express';
import type { Logger } from '../logger';

export function startHttpServer(app: Express, port: number, logger: Logger): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      logger.info('HTTP server listening', { port });
      resolve(server);
    });
    server.on('error', reject);
  });
}

type CleanupTask = () => Promise<unknown>;

/**
 * Runs cleanup tasks in order on SIGTERM/SIGINT (stop accepting traffic, then close clients),
 * forcing exit if shutdown takes too long.
 */
export function registerGracefulShutdown(logger: Logger, tasks: CleanupTask[], timeoutMs = 10000): void {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutting down', { signal });
    setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, timeoutMs).unref();

    for (const task of tasks) {
      try {
        await task();
      } catch (err) {
        logger.error('Cleanup task failed', { error: (err as Error).message });
      }
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { error: reason instanceof Error ? reason.stack : String(reason) });
  });
}

export function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}
