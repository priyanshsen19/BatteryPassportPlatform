import { passportRequestSchema, requireRole, validateBody, validateObjectIdParam } from '@bpp/shared';
import { Router, type RequestHandler } from 'express';
import type { PassportController } from '../controllers/passport.controller';

export function createPassportRouter(
  controller: PassportController,
  authenticateJWT: RequestHandler,
): Router {
  const router = Router();
  const anyRole = requireRole('admin', 'user');
  const adminOnly = requireRole('admin');

  router.use(authenticateJWT);

  router.get('/', anyRole, controller.list);
  router.post('/', adminOnly, validateBody(passportRequestSchema), controller.create);

  router.get('/:id', validateObjectIdParam('id'), anyRole, controller.getById);
  router.put(
    '/:id',
    validateObjectIdParam('id'),
    adminOnly,
    validateBody(passportRequestSchema),
    controller.update,
  );
  router.delete('/:id', validateObjectIdParam('id'), adminOnly, controller.remove);

  return router;
}
