process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';

import { AppError } from '@bpp/shared';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

// Stand-in for Google's token verification: tokens are "google:<sub>:<email>[:unverified]".
jest.mock('../src/services/google.verifier', () => ({
  createGoogleVerifier: () => ({
    verify: async (idToken: string) => {
      const [prefix, googleId, email, flag] = idToken.split(':');
      if (prefix !== 'google') throw new AppError(401, 'INVALID_GOOGLE_TOKEN', 'Invalid Google credential');
      return { googleId, email, emailVerified: flag !== 'unverified' };
    },
  }),
}));

import { createApp } from '../src/app';
import { UserModel } from '../src/models/user.model';

const app = createApp();
let mongod: MongoMemoryServer;

const googleLogin = (idToken: string) => request(app).post('/api/auth/google').send({ idToken });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await UserModel.init();
});

afterEach(async () => {
  await UserModel.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('POST /api/auth/google', () => {
  it('creates a user-role account on first sign-in and returns a platform JWT', async () => {
    const res = await googleLogin('google:g-123:new.person@gmail.com');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      tokenType: 'Bearer',
      user: { email: 'new.person@gmail.com', role: 'user' },
    });

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.data.token}`);
    expect(me.status).toBe(200);
    expect(await UserModel.countDocuments({ googleId: 'g-123' })).toBe(1);
  });

  it('signs a returning Google user into the same account', async () => {
    const first = await googleLogin('google:g-123:person@gmail.com');
    const second = await googleLogin('google:g-123:person@gmail.com');
    expect(second.body.data.user.id).toBe(first.body.data.user.id);
    expect(await UserModel.countDocuments()).toBe(1);
  });

  it('links to an existing password account with the same email and keeps its role', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'admin@example.com', password: 'AdminPassw0rd' });
    await UserModel.updateOne({ email: 'admin@example.com' }, { $set: { role: 'admin' } });

    const res = await googleLogin('google:g-admin:admin@example.com');
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: 'admin@example.com', role: 'admin' });

    // The password still works after linking.
    const password = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'AdminPassw0rd' });
    expect(password.status).toBe(200);
  });

  it('rejects Google accounts whose email is not verified', async () => {
    const res = await googleLogin('google:g-1:someone@example.com:unverified');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('GOOGLE_EMAIL_UNVERIFIED');
  });

  it('rejects an invalid Google token', async () => {
    const res = await googleLogin('forged-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_GOOGLE_TOKEN');
  });

  it('refuses to link an email already linked to another Google account', async () => {
    await googleLogin('google:g-1:shared@example.com');
    const res = await googleLogin('google:g-2:shared@example.com');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACCOUNT_LINKED_ELSEWHERE');
  });

  it('requires an idToken', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    expect(res.status).toBe(422);
  });

  it('does not allow password login for Google-only accounts', async () => {
    await googleLogin('google:g-9:google.only@gmail.com');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'google.only@gmail.com', password: 'anything-at-all' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});
