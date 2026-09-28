import { Errors, parseQuery, passportListQuerySchema, sendSuccess } from '@bpp/shared';
import type { Request, Response } from 'express';
import type { PassportService, RequestContext } from '../services/passport.service';

function contextOf(req: Request): RequestContext {
  if (!req.user) throw Errors.unauthorized();
  return { user: req.user, requestId: req.requestId };
}

const idOf = (req: Request) => req.params.id as string;

export function createPassportController(service: PassportService) {
  return {
    async create(req: Request, res: Response): Promise<void> {
      const passport = await service.create(req.body.data, contextOf(req));
      res.location(`${req.baseUrl}/${passport.id}`);
      sendSuccess(res, passport, 201);
    },

    async list(req: Request, res: Response): Promise<void> {
      sendSuccess(res, await service.list(parseQuery(passportListQuerySchema, req.query)));
    },

    async getById(req: Request, res: Response): Promise<void> {
      sendSuccess(res, await service.getById(idOf(req)));
    },

    async update(req: Request, res: Response): Promise<void> {
      sendSuccess(res, await service.update(idOf(req), req.body.data, contextOf(req)));
    },

    async remove(req: Request, res: Response): Promise<void> {
      sendSuccess(res, await service.remove(idOf(req), contextOf(req)));
    },
  };
}

export type PassportController = ReturnType<typeof createPassportController>;
