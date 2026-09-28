import { z } from 'zod';
import { objectIdSchema } from './common';

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

/** Types a browser can render safely inline; everything else is always served as a download. */
export const PREVIEWABLE_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] as const;

export type DownloadDisposition = 'attachment' | 'inline';

/** Query parameters of GET /api/documents/:docId. */
export const documentDownloadQuerySchema = z.object({
  disposition: z.enum(['attachment', 'inline']).default('attachment'),
});

/** Text fields accepted alongside the file in POST /api/documents/upload. */
export const uploadDocumentFieldsSchema = z.object({
  passportId: objectIdSchema.optional(),
});

/** Body of PUT /api/documents/:docId (metadata only). */
export const updateDocumentSchema = z
  .strictObject({
    fileName: z.string().trim().min(1, 'File name is required').max(255).optional(),
    passportId: objectIdSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update (fileName, passportId)',
  });

export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  passportId: objectIdSchema.optional(),
});

export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export interface DocumentDto {
  docId: string;
  fileName: string;
  objectKey: string;
  mimeType: string;
  size: number;
  passportId: string | null;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadDocumentResult {
  docId: string;
  fileName: string;
  createdAt: string;
}

export interface DocumentDownload {
  document: DocumentDto;
  downloadUrl: string;
  expiresIn: number;
  disposition: DownloadDisposition;
}
