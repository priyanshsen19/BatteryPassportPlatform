import { randomUUID } from 'crypto';
import path from 'path';

const MAX_NAME_LENGTH = 100;

/**
 * Reduces a client-supplied file name to a safe S3 key segment: no path components, only
 * [A-Za-z0-9._-], no leading dots, bounded length, extension preserved where possible.
 */
export function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName.replace(/\\/g, '/'));
  const ascii = base.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const cleaned = ascii
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[.-]+/, '')
    .replace(/-+(\.[^.]*)?$/, '$1');

  if (!cleaned || cleaned.startsWith('.')) return 'file';
  if (cleaned.length <= MAX_NAME_LENGTH) return cleaned;

  const ext = path.extname(cleaned).slice(0, 16);
  return `${cleaned.slice(0, MAX_NAME_LENGTH - ext.length)}${ext}`;
}

/** documents/{passportId}/{uuid}-{sanitizedFileName}; unlinked uploads use "unassigned". */
export function buildObjectKey(fileName: string, passportId?: string | null): string {
  return `documents/${passportId ?? 'unassigned'}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}
