import 'server-only';

type Level = 'info' | 'warn' | 'error';

/** Structured JSON logs on stdout, matching the format of the backend services. */
export function log(level: Level, message: string, meta: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: 'web',
    message,
    ...meta,
  });
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : console.log)(line);
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
