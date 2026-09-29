import {
  requirePermission,
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
  const canRead = requirePermission('document:read');
  const canWrite = requirePermission('document:write');
  const canDelete = requirePermission('document:delete');
  const validDocId = validateObjectIdParam('docId');

  router.use(authenticateJWT);

  router.get('/', canRead, controller.list);
  router.post(
    '/upload',
    canWrite,
    uploadSingleFile(maxUploadSizeBytes),
    validateBody(uploadDocumentFieldsSchema),
    controller.upload,
  );

  router.get('/:docId', validDocId, canRead, controller.getDownload);
  router.put('/:docId', validDocId, canWrite, validateBody(updateDocumentSchema), controller.update);
  router.delete('/:docId', validDocId, canDelete, controller.remove);

  return router;
}
