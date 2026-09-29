import {
  AppError,
  Errors,
  PREVIEWABLE_MIME_TYPES,
  type AuthUser,
  type DocumentDownload,
  type DocumentDto,
  type DownloadDisposition,
  type Paginated,
  type UpdateDocumentInput,
  type UploadDocumentResult,
} from '@bpp/shared';
import type { PassportClient } from '../clients/passportClient';
import { logger } from '../config';
import { toDocumentDto, type DocumentRecord } from '../models/document.model';
import { documentRepository } from '../repositories/document.repository';
import { buildObjectKey } from '../storage/objectKey';
import type { ObjectStorage } from '../storage/objectStorage';

const previewableTypes: ReadonlySet<string> = new Set(PREVIEWABLE_MIME_TYPES);

export interface RequestContext {
  user: AuthUser;
  requestId: string;
  authorization: string;
}

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const storageError = (operation: string, err: unknown, meta: Record<string, unknown>) => {
  logger.error(`S3 ${operation} failed`, {
    ...meta,
    error: (err as Error).message,
    errorName: (err as Error).name,
  });
  return Errors.badGateway('STORAGE_ERROR', 'File storage request failed, please try again');
};

export function createDocumentService(storage: ObjectStorage, passports: PassportClient) {
  async function findOrThrow(docId: string): Promise<DocumentRecord> {
    const doc = await documentRepository.findById(docId);
    if (!doc) throw Errors.notFound('DOCUMENT_NOT_FOUND', 'Document not found');
    return doc;
  }

  return {
    async upload(
      file: UploadedFile,
      passportId: string | undefined,
      ctx: RequestContext,
    ): Promise<UploadDocumentResult> {
      if (passportId) await passports.assertPassportExists(passportId, ctx.authorization, ctx.requestId);

      const objectKey = buildObjectKey(file.originalname, passportId);
      try {
        await storage.putObject({ key: objectKey, body: file.buffer, contentType: file.mimetype });
      } catch (err) {
        throw storageError('upload', err, { objectKey, requestId: ctx.requestId });
      }

      let doc: DocumentRecord;
      try {
        doc = await documentRepository.create({
          fileName: file.originalname,
          objectKey,
          mimeType: file.mimetype,
          size: file.size,
          passportId: passportId ?? null,
          uploadedBy: ctx.user.id,
        });
      } catch (err) {
        // Compensate so no unreferenced object is left behind in the bucket.
        await storage.deleteObject(objectKey).catch((cleanupErr: Error) =>
          logger.error('Failed to remove S3 object after metadata write failed; object is orphaned', {
            objectKey,
            requestId: ctx.requestId,
            error: cleanupErr.message,
          }),
        );
        throw err;
      }

      logger.info('Document uploaded', {
        docId: doc.id,
        objectKey,
        size: file.size,
        requestId: ctx.requestId,
      });
      return { docId: doc.id as string, fileName: doc.fileName, createdAt: doc.createdAt.toISOString() };
    },

    async list(
      filter: { passportId?: string },
      page: number,
      limit: number,
    ): Promise<Paginated<DocumentDto>> {
      const { items, total } = await documentRepository.list(filter, page, limit);
      return { items: items.map(toDocumentDto), page, limit, total };
    },

    /**
     * Any authenticated role may download; the link is short-lived and the bucket stays private.
     * Inline (preview) links are only issued for PDFs and images; other types are always
     * served as attachments.
     */
    async getDownload(
      docId: string,
      ctx: RequestContext,
      requested: DownloadDisposition = 'attachment',
    ): Promise<DocumentDownload> {
      const doc = await findOrThrow(docId);
      const disposition =
        requested === 'inline' && previewableTypes.has(doc.mimeType) ? 'inline' : 'attachment';
      try {
        const { url, expiresIn } = await storage.getDownloadUrl(doc.objectKey, doc.fileName, disposition);
        logger.info('Download URL issued', {
          docId,
          disposition,
          userId: ctx.user.id,
          requestId: ctx.requestId,
        });
        return { document: toDocumentDto(doc), downloadUrl: url, expiresIn, disposition };
      } catch (err) {
        throw storageError('presign', err, { docId, requestId: ctx.requestId });
      }
    },

    async updateMetadata(
      docId: string,
      changes: UpdateDocumentInput,
      ctx: RequestContext,
    ): Promise<DocumentDto> {
      await findOrThrow(docId);
      if (changes.passportId) {
        await passports.assertPassportExists(changes.passportId, ctx.authorization, ctx.requestId);
      }

      const updated = await documentRepository.updateMetadata(docId, changes);
      if (!updated) throw Errors.notFound('DOCUMENT_NOT_FOUND', 'Document not found');

      logger.info('Document metadata updated', {
        docId,
        fields: Object.keys(changes),
        requestId: ctx.requestId,
      });
      return toDocumentDto(updated);
    },

    /**
     * Deletes the S3 object first, then the metadata. If S3 fails nothing is removed and the
     * client can retry; if the metadata delete fails after the object is gone, it is logged
     * as an inconsistency and surfaced as a 500.
     */
    async remove(docId: string, ctx: RequestContext): Promise<{ docId: string }> {
      const doc = await findOrThrow(docId);

      try {
        await storage.deleteObject(doc.objectKey);
      } catch (err) {
        throw storageError('delete', err, { docId, objectKey: doc.objectKey, requestId: ctx.requestId });
      }

      try {
        await documentRepository.deleteById(docId);
      } catch (err) {
        logger.error(
          'S3 object deleted but metadata removal failed; metadata now references a missing object',
          {
            docId,
            objectKey: doc.objectKey,
            requestId: ctx.requestId,
            error: (err as Error).message,
          },
        );
        throw new AppError(
          500,
          'PARTIAL_DELETE',
          'The file was deleted but its metadata could not be removed',
        );
      }

      logger.info('Document deleted', { docId, objectKey: doc.objectKey, requestId: ctx.requestId });
      return { docId };
    },
  };
}

export type DocumentService = ReturnType<typeof createDocumentService>;
