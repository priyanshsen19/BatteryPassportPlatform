/** Building blocks shared by every service's OpenAPI document. */

export const bearerAuthScheme = {
  bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
} as const;

export const errorEnvelopeSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'VALIDATION_ERROR' },
        message: { type: 'string', example: 'Request validation failed' },
        details: {
          type: 'array',
          items: {
            type: 'object',
            properties: { field: { type: 'string' }, message: { type: 'string' } },
          },
        },
        requestId: { type: 'string', format: 'uuid' },
      },
    },
  },
} as const;

const ERROR_EXAMPLES: Record<number, { description: string; code: string; message: string }> = {
  400: {
    description: 'Malformed request',
    code: 'BAD_REQUEST',
    message: 'Request body contains malformed JSON',
  },
  401: {
    description: 'Missing, invalid or expired token',
    code: 'UNAUTHORIZED',
    message: 'Authentication required',
  },
  403: {
    description: 'Authenticated but not allowed',
    code: 'INSUFFICIENT_ROLE',
    message: 'This action requires one of the following roles: admin',
  },
  404: { description: 'Resource not found', code: 'NOT_FOUND', message: 'Resource not found' },
  409: {
    description: 'Conflict with an existing resource',
    code: 'CONFLICT',
    message: 'Resource already exists',
  },
  413: {
    description: 'Payload too large',
    code: 'PAYLOAD_TOO_LARGE',
    message: 'File exceeds the maximum size',
  },
  415: {
    description: 'Unsupported media type',
    code: 'UNSUPPORTED_MEDIA_TYPE',
    message: 'File type is not allowed',
  },
  422: { description: 'Validation failed', code: 'VALIDATION_ERROR', message: 'Request validation failed' },
  502: {
    description: 'Upstream dependency failed',
    code: 'STORAGE_ERROR',
    message: 'File storage request failed',
  },
  503: {
    description: 'Dependency unavailable',
    code: 'AUTH_SERVICE_UNAVAILABLE',
    message: 'Authentication service is unavailable',
  },
};

export function errorResponses(...statusCodes: number[]): Record<number, object> {
  return Object.fromEntries(
    statusCodes.map((status) => {
      const { description, code, message } = ERROR_EXAMPLES[status];
      return [
        status,
        {
          description,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { success: false, error: { code, message } },
            },
          },
        },
      ];
    }),
  );
}

export function successResponse(description: string, dataSchema: object, example?: unknown): object {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: { success: { type: 'boolean', example: true }, data: dataSchema },
        },
        ...(example !== undefined ? { example: { success: true, data: example } } : {}),
      },
    },
  };
}

export const healthPath = {
  get: {
    tags: ['Health'],
    summary: 'Service health',
    security: [],
    responses: {
      200: {
        description: 'Service and its dependencies are healthy',
        content: {
          'application/json': {
            example: { status: 'ok', service: 'service-name', dependencies: { mongodb: 'up' } },
          },
        },
      },
      503: { description: 'A dependency is down' },
    },
  },
};
