import winston from 'winston';

export type Logger = winston.Logger;

const SENSITIVE_KEYS = new Set([
  'password',
  'authorization',
  'cookie',
  'token',
  'jwt',
  'secret',
  'jwtsecret',
  'accesskeyid',
  'secretaccesskey',
]);

/** Masks well-known sensitive fields so they can never reach log output by accident. */
const redact = winston.format((info) => {
  for (const key of Object.keys(info)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) info[key] = '[REDACTED]';
  }
  return info;
});

const prettyFormat = winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level.toUpperCase().padEnd(5)} [${service}] ${message}${extra}`;
});

export interface LoggerOptions {
  level?: string;
  pretty?: boolean;
  silent?: boolean;
}

/**
 * Structured JSON logger: every line carries timestamp, level, service and message, plus
 * any metadata such as requestId. Containers log to stdout so a collector can aggregate them.
 */
export function createLogger(service: string, options: LoggerOptions = {}): Logger {
  return winston.createLogger({
    level: options.level ?? 'info',
    silent: options.silent ?? false,
    defaultMeta: { service },
    format: winston.format.combine(
      redact(),
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      options.pretty ? prettyFormat : winston.format.json(),
    ),
    transports: [new winston.transports.Console()],
  });
}
