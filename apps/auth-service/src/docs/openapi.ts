import { bearerAuthScheme, errorEnvelopeSchema, errorResponses, healthPath, successResponse } from '@bpp/shared';

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: '6700f1c2a7d4e5f601234567' },
    email: { type: 'string', format: 'email', example: 'admin@example.com' },
    role: { type: 'string', enum: ['admin', 'user'], example: 'admin' },
  },
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Auth Service',
    version: '1.0.0',
    description:
      'User registration and login with bcrypt-hashed passwords and JWT access tokens. ' +
      'Other services call `GET /api/auth/me` over HTTP to verify tokens and resolve the caller role.',
  },
  servers: [{ url: 'http://localhost:4001' }],
  tags: [{ name: 'Auth' }, { name: 'Health' }],
  components: {
    securitySchemes: bearerAuthScheme,
    schemas: { Error: errorEnvelopeSchema, User: userSchema },
  },
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a user',
        description: 'Public. `role` must be `admin` or `user` (defaults to `user`).',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8, maxLength: 128 },
                  role: { type: 'string', enum: ['admin', 'user'], default: 'user' },
                },
              },
              example: { email: 'admin@example.com', password: 'Str0ngPassw0rd', role: 'admin' },
            },
          },
        },
        responses: {
          201: successResponse(
            'User created',
            { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } },
            {
              user: {
                id: '6700f1c2a7d4e5f601234567',
                email: 'admin@example.com',
                role: 'admin',
                createdAt: '2024-10-05T10:00:00.000Z',
                updatedAt: '2024-10-05T10:00:00.000Z',
              },
            },
          ),
          ...errorResponses(400, 409, 422),
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and obtain a JWT',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
              },
              example: { email: 'admin@example.com', password: 'Str0ngPassw0rd' },
            },
          },
        },
        responses: {
          200: successResponse(
            'Authenticated',
            {
              type: 'object',
              properties: {
                token: { type: 'string' },
                tokenType: { type: 'string', example: 'Bearer' },
                expiresIn: { type: 'string', example: '1h' },
                user: { $ref: '#/components/schemas/User' },
              },
            },
            {
              token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              tokenType: 'Bearer',
              expiresIn: '1h',
              user: { id: '6700f1c2a7d4e5f601234567', email: 'admin@example.com', role: 'admin' },
            },
          ),
          ...errorResponses(400, 401, 422),
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user (token verification)',
        description: 'Requires a valid JWT. Any role.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: successResponse(
            'Token is valid',
            { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } },
            { user: { id: '6700f1c2a7d4e5f601234567', email: 'admin@example.com', role: 'admin' } },
          ),
          ...errorResponses(401),
        },
      },
    },
    '/health': healthPath,
  },
};
