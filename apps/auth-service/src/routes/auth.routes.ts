import {
  googleAuthSchema,
  loginSchema,
  registerSchema,
  requirePermission,
  updateUserRoleSchema,
  validateBody,
  validateObjectIdParam,
} from '@bpp/shared';
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticateJWT } from '../middleware/authenticate';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), authController.register);
authRouter.post('/login', validateBody(loginSchema), authController.login);
authRouter.post('/google', validateBody(googleAuthSchema), authController.google);
authRouter.get('/me', authenticateJWT, authController.me);

// User and role management: admins only.
authRouter.get('/users', authenticateJWT, requirePermission('user:manage'), authController.listUsers);
authRouter.patch(
  '/users/:id/role',
  authenticateJWT,
  requirePermission('user:manage'),
  validateObjectIdParam('id'),
  validateBody(updateUserRoleSchema),
  authController.changeRole,
);
