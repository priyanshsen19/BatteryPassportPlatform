import {
  requireRole,
  updateDocumentSchema,
  uploadDocumentFieldsSchema,
  validateBody,
  validateObjectIdParam,
} from '@bpp/shared';
import { Router, type RequestHandler } from 'express';
import type { DocumentController } from '../controllers/document.controller';
import { uploadSingleFile } from '../middleware/upload';

export function createDocumentRouter(
  controller: DocumentController,
  authenticateJWT: RequestHandler,
  maxUploadSizeBytes: number,
): Router {
  const router = Router();
  const anyRole = requireRole('admin', 'user');
  const adminOnly = requireRole('admin');
  const validDocId = validateObjectIdParam('docId');

  router.use(authenticateJWT);

  router.get('/', anyRole, controller.list);
  router.post(
    '/upload',
    adminOnly,
    uploadSingleFile(maxUploadSizeBytes),
    validateBody(uploadDocumentFieldsSchema),
    controller.upload,
  );

  router.get('/:docId', validDocId, anyRole, controller.getDownload);
  router.put('/:docId', validDocId, adminOnly, validateBody(updateDocumentSchema), controller.update);
  router.delete('/:docId', validDocId, adminOnly, controller.remove);

  return router;
}
