import { sendSuccess } from '@bpp/shared';
import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const user = await authService.register(req.body);
    sendSuccess(res, { user }, 201);
  },

  async login(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await authService.login(req.body));
  },

  /** Also used by the passport and document services to verify tokens over HTTP. */
  me(req: Request, res: Response): void {
    sendSuccess(res, { user: req.user });
  },
};
