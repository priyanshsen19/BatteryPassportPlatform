import { passportRequestSchema, requirePermission, validateBody, validateObjectIdParam } from '@bpp/shared';
import { Router, type RequestHandler } from 'express';
import type { PassportController } from '../controllers/passport.controller';

export function createPassportRouter(
  controller: PassportController,
  authenticateJWT: RequestHandler,
): Router {
  const router = Router();
  const canRead = requirePermission('passport:read');
  const canWrite = requirePermission('passport:write');
  const canDelete = requirePermission('passport:delete');

  router.use(authenticateJWT);

  router.get('/', canRead, controller.list);
  router.post('/', canWrite, validateBody(passportRequestSchema), controller.create);

  router.get('/:id', validateObjectIdParam('id'), canRead, controller.getById);
  router.put(
    '/:id',
    validateObjectIdParam('id'),
    canWrite,
    validateBody(passportRequestSchema),
    controller.update,
  );
  router.delete('/:id', validateObjectIdParam('id'), canDelete, controller.remove);

  return router;
}
