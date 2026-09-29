import {
  bearerAuthScheme,
  errorEnvelopeSchema,
  errorResponses,
  healthPath,
  successResponse,
} from '@bpp/shared';

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: '6700f1c2a7d4e5f601234567' },
    email: { type: 'string', format: 'email', example: 'admin@example.com' },
    role: { type: 'string', enum: ['admin', 'developer', 'tester', 'user'], example: 'admin' },
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
  tags: [{ name: 'Auth' }, { name: 'Users' }, { name: 'Health' }],
  components: {
    securitySchemes: bearerAuthScheme,
    schemas: { Error: errorEnvelopeSchema, User: userSchema },
  },
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a user',
        description:
          'Public. `role` is optional (`admin`, `developer`, `tester` or `user`) and defaults to `user`. Admins can change roles later with `PATCH /api/auth/users/{id}/role`.',
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
                  role: { type: 'string', enum: ['admin', 'developer', 'tester', 'user'], default: 'user' },
                },
              },
              example: { email: 'new.user@example.com', password: 'Str0ngPassw0rd', role: 'user' },
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
                email: 'new.user@example.com',
                role: 'user',
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
    '/api/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request a password reset link',
        description:
          'Public. Emails a single-use link to `{PUBLIC_APP_URL}/reset-password?token=…` that expires after `PASSWORD_RESET_TTL_MINUTES`. The response is the same whether or not the email is registered.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
              example: { email: 'user@example.com' },
            },
          },
        },
        responses: {
          200: successResponse(
            'Request accepted',
            { type: 'object', properties: { message: { type: 'string' } } },
            { message: 'If an account exists for this email, a password reset link has been sent.' },
          ),
          ...errorResponses(400, 422),
        },
      },
    },
    '/api/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Set a new password from a reset link',
        description:
          'Public. Consumes the token from the emailed link. Tokens issued before the reset are rejected afterwards (`TOKEN_REVOKED`), so every existing session is signed out.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'password'],
                properties: {
                  token: { type: 'string' },
                  password: { type: 'string', minLength: 8, maxLength: 128 },
                },
              },
              example: { token: 'rG3k…from-the-email-link', password: 'N3wStr0ngPassw0rd' },
            },
          },
        },
        responses: {
          200: successResponse(
            'Password updated',
            { type: 'object', properties: { message: { type: 'string' } } },
            { message: 'Your password has been updated. Sign in with your new password.' },
          ),
          ...errorResponses(400, 422),
        },
      },
    },
    '/api/auth/google': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in with Google',
        description:
          'Exchanges a Google ID token (from the OAuth authorization-code flow) for a platform JWT. ' +
          'A new account is created with the `user` role; an existing account with the same verified email ' +
          'is linked and keeps its role. Returns `503 GOOGLE_AUTH_DISABLED` when `GOOGLE_CLIENT_ID` is not set.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['idToken'],
                properties: { idToken: { type: 'string', description: 'Google ID token (JWT)' } },
              },
            },
          },
        },
        responses: {
          200: successResponse('Authenticated; same response as /api/auth/login', {
            type: 'object',
            properties: {
              token: { type: 'string' },
              tokenType: { type: 'string', example: 'Bearer' },
              expiresIn: { type: 'string', example: '1h' },
              user: { $ref: '#/components/schemas/User' },
            },
          }),
          ...errorResponses(401, 409, 422, 503),
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
    '/api/auth/users': {
      get: {
        tags: ['Users'],
        summary: 'List users and their roles',
        description: 'Role: **admin**. Supports `q` (email search) and `role` filters.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
          {
            name: 'role',
            in: 'query',
            schema: { type: 'string', enum: ['admin', 'developer', 'tester', 'user'] },
          },
        ],
        responses: {
          200: successResponse(
            'Paginated users',
            { type: 'object' },
            {
              items: [
                {
                  id: '6700f1c2a7d4e5f601234567',
                  email: 'dev@example.com',
                  role: 'developer',
                  signInMethods: ['password', 'google'],
                  createdAt: '2024-10-05T10:00:00.000Z',
                  updatedAt: '2024-10-05T10:00:00.000Z',
                },
              ],
              page: 1,
              limit: 20,
              total: 1,
            },
          ),
          ...errorResponses(401, 403, 422),
        },
      },
    },
    '/api/auth/users/{id}/role': {
      patch: {
        tags: ['Users'],
        summary: "Change a user's role",
        description:
          "Role: **admin**. Takes effect on the user's next request. Admins cannot change their own role (400 `CANNOT_CHANGE_OWN_ROLE`).",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['role'],
                properties: { role: { type: 'string', enum: ['admin', 'developer', 'tester', 'user'] } },
              },
              example: { role: 'developer' },
            },
          },
        },
        responses: {
          200: successResponse('Updated user', { $ref: '#/components/schemas/User' }),
          ...errorResponses(400, 401, 403, 404, 422),
        },
      },
    },
    '/health': healthPath,
  },
};
