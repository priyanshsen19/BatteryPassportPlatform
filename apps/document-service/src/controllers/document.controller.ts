import { Errors, listDocumentsQuerySchema, parseQuery, sendSuccess } from '@bpp/shared';
import type { Request, Response } from 'express';
import type { DocumentService, RequestContext } from '../services/document.service';

function contextOf(req: Request): RequestContext {
  if (!req.user) throw Errors.unauthorized();
  return { user: req.user, requestId: req.requestId, authorization: req.get('authorization') ?? '' };
}

const docIdOf = (req: Request) => req.params.docId as string;

export function createDocumentController(service: DocumentService) {
  return {
    async upload(req: Request, res: Response): Promise<void> {
      if (!req.file) throw Errors.validation([{ field: 'file', message: 'A file is required' }]);
      const result = await service.upload(req.file, req.body.passportId, contextOf(req));
      res.location(`${req.baseUrl}/${result.docId}`);
      sendSuccess(res, result, 201);
    },

    async list(req: Request, res: Response): Promise<void> {
      const { page, limit, passportId } = parseQuery(listDocumentsQuerySchema, req.query);
      sendSuccess(res, await service.list({ passportId }, page, limit));
    },

    async getDownload(req: Request, res: Response): Promise<void> {
      sendSuccess(res, await service.getDownload(docIdOf(req), contextOf(req)));
    },

    async update(req: Request, res: Response): Promise<void> {
      sendSuccess(res, await service.updateMetadata(docIdOf(req), req.body, contextOf(req)));
    },

    async remove(req: Request, res: Response): Promise<void> {
      sendSuccess(res, await service.remove(docIdOf(req), contextOf(req)));
    },
  };
}

export type DocumentController = ReturnType<typeof createDocumentController>;
