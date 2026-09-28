import { ALLOWED_DOCUMENT_MIME_TYPES, Errors } from '@bpp/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';

const FILE_FIELD = 'file';
const allowedTypes: ReadonlySet<string> = new Set(ALLOWED_DOCUMENT_MIME_TYPES);

/**
 * Parses multipart/form-data holding exactly one file in the "file" field. The file is
 * buffered in memory (bounded by maxSizeBytes) and then streamed to S3 by the service.
 */
export function uploadSingleFile(maxSizeBytes: number): RequestHandler {
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeBytes, files: 1, fields: 10, fieldSize: 1024 },
    fileFilter: (_req, file, callback) => {
      if (!allowedTypes.has(file.mimetype)) {
        return callback(Errors.unsupportedMediaType(`File type '${file.mimetype}' is not allowed`));
      }
      return callback(null, true);
    },
  }).single(FILE_FIELD);

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.is('multipart/form-data')) {
      return next(Errors.unsupportedMediaType('Request must be multipart/form-data'));
    }

    return parser(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            Errors.payloadTooLarge(`File exceeds the maximum size of ${maxSizeBytes / 1024 / 1024} MB`),
          );
        }
        return next(
          Errors.badRequest(`Send exactly one file in the '${FILE_FIELD}' form field`, 'INVALID_UPLOAD'),
        );
      }
      if (err) return next(err);

      if (!req.file) {
        return next(Errors.validation([{ field: FILE_FIELD, message: 'A file is required' }]));
      }
      if (req.file.size === 0) {
        return next(Errors.validation([{ field: FILE_FIELD, message: 'The file is empty' }]));
      }
      // Multer decodes multipart file names as latin1; browsers send UTF-8.
      req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      return next();
    });
  };
}
