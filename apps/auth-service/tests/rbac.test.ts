import { createErrorHandler, requestId, requireRole, sendSuccess } from '@bpp/shared';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import { logger } from '../src/config';
import { authenticateJWT } from '../src/middleware/authenticate';
import { UserModel } from '../src/models/user.model';

const authApp = createApp();

// A minimal protected API wired with the same middleware the services use.
const protectedApp = express();
protectedApp.use(requestId());
protectedApp.get('/admin-only', authenticateJWT, requireRole('admin'), (_req, res) =>
  sendSuccess(res, { ok: true }),
);
protectedApp.get('/any-role', authenticateJWT, requireRole('admin', 'user'), (_req, res) =>
  sendSuccess(res, { ok: true }),
);
protectedApp.use(createErrorHandler(logger, { exposeInternalErrors: false }));

let mongod: MongoMemoryServer;

async function tokenFor(role: 'admin' | 'user'): Promise<string> {
  const email = `${role}@example.com`;
  await request(authApp).post('/api/auth/register').send({ email, password: 'Passw0rd123', role });
  const res = await request(authApp).post('/api/auth/login').send({ email, password: 'Passw0rd123' });
  return res.body.data.token as string;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await UserModel.deleteMany({});
  await mongoose.disconnect();
  await mongod.stop();
});

describe('requireRole', () => {
  it('allows an admin through an admin-only route', async () => {
    const res = await request(protectedApp)
      .get('/admin-only')
      .set('Authorization', `Bearer ${await tokenFor('admin')}`);
    expect(res.status).toBe(200);
  });

  it('rejects a user from an admin-only route with 403', async () => {
    const res = await request(protectedApp)
      .get('/admin-only')
      .set('Authorization', `Bearer ${await tokenFor('user')}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('allows a user through a route open to both roles', async () => {
    const res = await request(protectedApp)
      .get('/any-role')
      .set('Authorization', `Bearer ${await tokenFor('user')}`);
    expect(res.status).toBe(200);
  });

  it('returns 401 before checking roles when unauthenticated', async () => {
    const res = await request(protectedApp).get('/admin-only');
    expect(res.status).toBe(401);
  });
});
