import { Errors, listUsersQuerySchema, parseQuery, sendSuccess } from '@bpp/shared';
import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { userAdminService } from '../services/user-admin.service';

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const user = await authService.register(req.body);
    sendSuccess(res, { user }, 201);
  },

  async login(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await authService.login(req.body));
  },

  async google(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await authService.loginWithGoogle(req.body.idToken));
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
