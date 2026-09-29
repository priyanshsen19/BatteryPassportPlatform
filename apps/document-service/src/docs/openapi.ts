import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  bearerAuthScheme,
  errorEnvelopeSchema,
  errorResponses,
  healthPath,
  successResponse,
} from '@bpp/shared';

const str = { type: 'string' };

const exampleDocument = {
  docId: '6701a2b3c4d5e6f701234567',
  fileName: 'lca-report.pdf',
  objectKey: 'documents/6700f1c2a7d4e5f601234567/0f8fad5b-d9cb-469f-a165-70867728950e-lca-report.pdf',
  mimeType: 'application/pdf',
  size: 184320,
  passportId: '6700f1c2a7d4e5f601234567',
  uploadedBy: '6700f0a1a7d4e5f601234560',
  createdAt: '2024-10-05T10:00:00.000Z',
  updatedAt: '2024-10-05T10:00:00.000Z',
};

const docIdParameter = {
  name: 'docId',
  in: 'path',
  required: true,
  schema: str,
  example: exampleDocument.docId,
};
const documentRef = { $ref: '#/components/schemas/Document' };

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Document Service',
    version: '1.0.0',
    description:
      'Stores document files in a private AWS S3 bucket and their metadata in MongoDB. Downloads use short-lived ' +
      `pre-signed URLs. Allowed file types: ${ALLOWED_DOCUMENT_MIME_TYPES.join(', ')}.`,
  },
  servers: [{ url: 'http://localhost:4003' }],
  tags: [{ name: 'Documents' }, { name: 'Health' }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: bearerAuthScheme,
    schemas: {
      Error: errorEnvelopeSchema,
      Document: {
        type: 'object',
        properties: {
          docId: str,
          fileName: str,
          objectKey: str,
          mimeType: str,
          size: { type: 'integer', description: 'Bytes' },
          passportId: { type: 'string', nullable: true },
          uploadedBy: str,
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/api/documents/upload': {
      post: {
        tags: ['Documents'],
        summary: 'Upload a file',
        description:
          'Roles: **admin**, **developer**. Stored at `documents/{passportId}/{uuid}-{sanitizedFileName}`.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary' },
                  passportId: { type: 'string', description: 'Optional id of an existing battery passport' },
                },
              },
            },
          },
        },
        responses: {
          201: successResponse(
            'Uploaded',
            {
              type: 'object',
              properties: { docId: str, fileName: str, createdAt: { type: 'string', format: 'date-time' } },
            },
            {
              docId: exampleDocument.docId,
              fileName: exampleDocument.fileName,
              createdAt: exampleDocument.createdAt,
            },
          ),
          ...errorResponses(400, 401, 403, 413, 415, 422, 502),
        },
      },
    },
    '/api/documents': {
      get: {
        tags: ['Documents'],
        summary: 'List document metadata',
        description: 'All roles. Optionally filter by passport.',
        parameters: [
          { name: 'passportId', in: 'query', schema: str },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          200: successResponse(
            'Paginated documents',
            {
              type: 'object',
              properties: {
                items: { type: 'array', items: documentRef },
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
              },
            },
            { items: [exampleDocument], page: 1, limit: 20, total: 1 },
          ),
          ...errorResponses(401, 422),
        },
      },
    },
    '/api/documents/{docId}': {
      parameters: [docIdParameter],
      get: {
        tags: ['Documents'],
        summary: 'Get a downloadable file link',
        description:
          'All roles. Returns a pre-signed S3 GET URL valid for `expiresIn` seconds. ' +
          '`disposition=inline` returns a link the browser can display (PDFs and images only; other types ' +
          'are always served as attachments).',
        parameters: [
          {
            name: 'disposition',
            in: 'query',
            schema: { type: 'string', enum: ['attachment', 'inline'], default: 'attachment' },
          },
        ],
        responses: {
          200: successResponse(
            'Pre-signed download URL',
            {
              type: 'object',
              properties: {
                document: documentRef,
                downloadUrl: { type: 'string', format: 'uri' },
                expiresIn: { type: 'integer', example: 300 },
                disposition: { type: 'string', enum: ['attachment', 'inline'] },
              },
            },
            {
              document: exampleDocument,
              downloadUrl: 'https://bucket.s3.eu-central-1.amazonaws.com/documents/...?X-Amz-Signature=...',
              expiresIn: 300,
              disposition: 'attachment',
            },
          ),
          ...errorResponses(400, 401, 404, 422, 502),
        },
      },
      put: {
        tags: ['Documents'],
        summary: 'Update file metadata',
        description:
          'Roles: **admin**, **developer**. Updates `fileName` and/or `passportId`; the stored object is not replaced.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { fileName: str, passportId: { type: 'string', nullable: true } },
              },
              example: { fileName: 'lca-report-2024.pdf' },
            },
          },
        },
        responses: {
          200: successResponse('Updated metadata', documentRef, {
            ...exampleDocument,
            fileName: 'lca-report-2024.pdf',
          }),
          ...errorResponses(400, 401, 403, 404, 422),
        },
      },
      delete: {
        tags: ['Documents'],
        summary: 'Delete a file',
        description: 'Role: **admin** only. Deletes the S3 object, then its metadata.',
        responses: {
          200: successResponse(
            'Deleted',
            { type: 'object', properties: { docId: str } },
            { docId: exampleDocument.docId },
          ),
          ...errorResponses(400, 401, 403, 404, 502),
        },
      },
    },
    '/health': healthPath,
  },
};
