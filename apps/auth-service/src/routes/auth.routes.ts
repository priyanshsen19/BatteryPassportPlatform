import {
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  registerSchema,
  requirePermission,
  resetPasswordSchema,
  updateUserRoleSchema,
  validateBody,
  verifyAccessCodeSchema,
  validateObjectIdParam,
} from '@bpp/shared';
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticateJWT } from '../middleware/authenticate';
import { createRateLimits } from '../middleware/rateLimits';

/** Built per app so every app instance (e.g. in tests) has its own rate-limit counters. */
export function createAuthRouter(): Router {
  const authRouter = Router();
  const limits = createRateLimits();

  authRouter.post('/register', validateBody(registerSchema), limits.accessCode, authController.register);
  authRouter.post(
    '/access-code/verify',
    validateBody(verifyAccessCodeSchema),
    limits.accessCode,
    authController.verifyAccessCode,
  );
  authRouter.post('/login', validateBody(loginSchema), limits.login, authController.login);
  authRouter.post('/google', validateBody(googleAuthSchema), authController.google);
  authRouter.post(
    '/forgot-password',
    validateBody(forgotPasswordSchema),
    limits.forgotPassword,
    authController.forgotPassword,
  );
  authRouter.post(
    '/reset-password',
    validateBody(resetPasswordSchema),
    limits.resetPassword,
    authController.resetPassword,
  );
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

  return authRouter;
}
