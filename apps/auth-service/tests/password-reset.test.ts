import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { PasswordResetMail } from '../src/services/mailer';

// Captures outgoing emails instead of sending them.
const sent: PasswordResetMail[] = [];
jest.mock('../src/services/mailer', () => ({
  mailer: { sendPasswordReset: async (mail: PasswordResetMail) => void sent.push(mail) },
}));

import { createApp } from '../src/app';
import { UserModel } from '../src/models/user.model';

const app = createApp();
let mongod: MongoMemoryServer;

const account = { email: 'reset@example.com', password: 'OriginalPassw0rd' };
const newPassword = 'BrandNewPassw0rd';

const forgot = (email: string) => request(app).post('/api/auth/forgot-password').send({ email });
const reset = (token: string, password = newPassword) =>
  request(app).post('/api/auth/reset-password').send({ token, password });
const login = (password: string) =>
  request(app).post('/api/auth/login').send({ email: account.email, password });
const tokenFrom = (mail: PasswordResetMail) => new URL(mail.resetUrl).searchParams.get('token') as string;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await UserModel.init();
});

beforeEach(async () => {
  sent.length = 0;
  await request(app).post('/api/auth/register').send(account);
});

afterEach(async () => {
  await UserModel.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('POST /api/auth/forgot-password', () => {
  it('emails a reset link to the web app and stores only a hash of the token', async () => {
    const res = await forgot(account.email);

    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(account.email);
    expect(sent[0].resetUrl).toMatch(/^http:\/\/localhost:3000\/reset-password\?token=/);

    const stored = await UserModel.findOne({ email: account.email }).select('+passwordResetTokenHash');
    expect(stored?.passwordResetTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.passwordResetTokenHash).not.toBe(tokenFrom(sent[0]));
  });

  it('gives the same response for an unknown email and sends nothing', async () => {
    const known = await forgot(account.email);
    const unknown = await forgot('nobody@example.com');

    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(sent).toHaveLength(1);
  });

  it('rejects an invalid email with 422', async () => {
    const res = await forgot('not-an-email');
    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('sets the new password and the old one stops working', async () => {
    await forgot(account.email);
    const res = await reset(tokenFrom(sent[0]));

    expect(res.status).toBe(200);
    expect((await login(account.password)).status).toBe(401);
    expect((await login(newPassword)).status).toBe(200);
  });

  it('accepts each link only once', async () => {
    await forgot(account.email);
    const token = tokenFrom(sent[0]);
    await reset(token);

    const again = await reset(token, 'AnotherPassw0rd');
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('rejects an expired link', async () => {
    await forgot(account.email);
    await UserModel.updateOne(
      { email: account.email },
      { passwordResetExpiresAt: new Date(Date.now() - 1000) },
    );

    const res = await reset(tokenFrom(sent[0]));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('only accepts the most recent link', async () => {
    await forgot(account.email);
    await forgot(account.email);

    expect((await reset(tokenFrom(sent[0]))).status).toBe(400);
    expect((await reset(tokenFrom(sent[1]))).status).toBe(200);
  });

  it('rejects a short password with 422', async () => {
    await forgot(account.email);
    const res = await reset(tokenFrom(sent[0]), 'short');
    expect(res.status).toBe(422);
  });

  it('signs out sessions that started before the reset', async () => {
    const oldToken = (await login(account.password)).body.data.token as string;
    // Token timestamps have one-second resolution.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    await forgot(account.email);
    await reset(tokenFrom(sent[0]));

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`);
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('TOKEN_REVOKED');

    const newToken = (await login(newPassword)).body.data.token as string;
    const fresh = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${newToken}`);
    expect(fresh.status).toBe(200);
  });
});
