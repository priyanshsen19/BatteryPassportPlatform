process.env.LOGIN_MAX_FAILED_ATTEMPTS = '3';
process.env.PASSWORD_RESET_MAX_REQUESTS = '2';
process.env.ACCESS_CODE_MAX_FAILED_ATTEMPTS = '3';

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { UserModel } from '../src/models/user.model';

// Each test gets a fresh app, so limiter counts never carry over between tests.
let app: Express;
let mongod: MongoMemoryServer;

const account = { email: 'limited@example.com', password: 'LimitedPassw0rd' };
const login = (password: string, email = account.email) =>
  request(app).post('/api/auth/login').send({ email, password });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await UserModel.init();
});

beforeEach(async () => {
  app = createApp();
  await request(app).post('/api/auth/register').send(account);
});

afterEach(async () => {
  await UserModel.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('login rate limit', () => {
  it('blocks an email after repeated failed logins, even with the right password', async () => {
    for (let i = 0; i < 3; i += 1) expect((await login('WrongPassw0rd')).status).toBe(401);

    const blocked = await login(account.password);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(blocked.body.error.message).toMatch(/try again in \d+ minutes?/);
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('does not count successful logins', async () => {
    for (let i = 0; i < 5; i += 1) expect((await login(account.password)).status).toBe(200);
  });

  it('limits each email separately', async () => {
    for (let i = 0; i < 3; i += 1) await login('WrongPassw0rd');
    expect((await login('WrongPassw0rd', 'someone-else@example.com')).status).toBe(401);
  });
});

describe('forgot-password rate limit', () => {
  const forgot = (email: string) => request(app).post('/api/auth/forgot-password').send({ email });

  it('allows a few reset emails per address, then returns 429', async () => {
    expect((await forgot(account.email)).status).toBe(200);
    expect((await forgot(account.email)).status).toBe(200);
    expect((await forgot(account.email)).status).toBe(429);
    expect((await forgot('other@example.com')).status).toBe(200);
  });
});

describe('access code rate limit', () => {
  const verify = (accessCode: string, clientIp = '203.0.113.7') =>
    request(app).post('/api/auth/access-code/verify').set('x-client-ip', clientIp).send({ accessCode });
  const register = (n: number, accessCode?: string) =>
    request(app)
      .post('/api/auth/register')
      .set('x-client-ip', '203.0.113.7')
      .send({ email: `new${n}@example.com`, password: 'NewPassw0rd!', accessCode });

  it('allows three wrong codes, then blocks even the right one', async () => {
    const first = await verify('guess-1');
    expect(first.status).toBe(403);
    expect(first.headers['ratelimit']).toMatch(/remaining=2/);
    expect((await verify('guess-2')).status).toBe(403);
    expect((await verify('guess-3')).status).toBe(403);

    const blocked = await verify('test-access-code-2026');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.message).toMatch(/try again in \d+ minutes?/);
  });

  it('counts wrong codes sent to registration too', async () => {
    expect((await register(1, 'guess-1')).body.data.user.role).toBe('user');
    expect((await register(2, 'guess-2')).body.data.user.role).toBe('user');
    expect((await verify('guess-3')).status).toBe(403);
    expect((await register(3, 'test-access-code-2026')).status).toBe(429);
  });

  it('does not count correct codes', async () => {
    for (let i = 0; i < 5; i += 1) expect((await verify('test-access-code-2026')).status).toBe(200);
  });

  it('keeps separate counts per visitor', async () => {
    for (let i = 0; i < 3; i += 1) await verify(`guess-${i}`);
    expect((await verify('test-access-code-2026', '198.51.100.9')).status).toBe(200);
  });

  it('caps wrong codes across all visitors, so rotating addresses does not help', async () => {
    for (let i = 0; i < 30; i += 1) await verify(`guess-${i}`, `198.51.100.${i + 1}`);
    expect((await verify('test-access-code-2026', '192.0.2.200')).status).toBe(429);
  });

  it('never limits sign-ups without a code', async () => {
    for (let i = 0; i < 5; i += 1) expect((await register(10 + i)).status).toBe(201);
  });
});
