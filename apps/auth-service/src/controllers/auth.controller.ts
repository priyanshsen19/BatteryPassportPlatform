import { Errors, listUsersQuerySchema, parseQuery, sendSuccess } from '@bpp/shared';
import type { Request, Response } from 'express';
import { authService, isValidAccessCode } from '../services/auth.service';
import { passwordResetService } from '../services/password-reset.service';
import { userAdminService } from '../services/user-admin.service';

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const { user, accessCodeRejected } = await authService.register(req.body);
    // Read by the registration rate limiter, which counts wrong access codes.
    res.locals.accessCodeRejected = accessCodeRejected;
    sendSuccess(res, { user }, 201);
  },

  /** Lets the sign-up page check an admin access code before creating the account. */
  verifyAccessCode(req: Request, res: Response): void {
    if (!isValidAccessCode(req.body.accessCode)) {
      throw Errors.forbidden('The access code is not valid', 'INVALID_ACCESS_CODE');
    }
    sendSuccess(res, { valid: true });
  },

  async login(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await authService.login(req.body));
  },

  async google(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await authService.loginWithGoogle(req.body.idToken));
  },

  async forgotPassword(req: Request, res: Response): Promise<void> {
    await passwordResetService.requestReset(req.body.email);
    sendSuccess(res, {
      message: 'If an account exists for this email, a password reset link has been sent.',
    });
  },

  async resetPassword(req: Request, res: Response): Promise<void> {
    await passwordResetService.resetPassword(req.body.token, req.body.password);
    sendSuccess(res, { message: 'Your password has been updated. Sign in with your new password.' });
  },

  /** Also used by the passport and document services to verify tokens over HTTP. */
  me(req: Request, res: Response): void {
    sendSuccess(res, { user: req.user });
  },

  async listUsers(req: Request, res: Response): Promise<void> {
    const { page, limit, q, role } = parseQuery(listUsersQuerySchema, req.query);
    sendSuccess(res, await userAdminService.list({ q, role }, page, limit));
  },

  async changeRole(req: Request, res: Response): Promise<void> {
    if (!req.user) throw Errors.unauthorized();
    const user = await userAdminService.changeRole(
      req.params.id as string,
      req.body.role,
      req.user,
      req.requestId,
    );
    sendSuccess(res, user);
  },
};
