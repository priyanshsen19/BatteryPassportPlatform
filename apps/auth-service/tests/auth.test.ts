import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import { UserModel } from '../src/models/user.model';

const app = createApp();
let mongod: MongoMemoryServer;

const admin = { email: 'admin@example.com', password: 'AdminPassw0rd', role: 'admin' };
const user = { email: 'user@example.com', password: 'UserPassw0rd', role: 'user' };

async function registerAndLogin(account: typeof admin): Promise<string> {
  await request(app).post('/api/auth/register').send(account);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: account.email, password: account.password });
  return res.body.data.token as string;
}

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

describe('POST /api/auth/register', () => {
  it('registers a user and stores a bcrypt hash, never the plaintext password', async () => {
    const res = await request(app).post('/api/auth/register').send(admin);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, data: { user: { email: admin.email, role: 'admin' } } });
    expect(JSON.stringify(res.body)).not.toContain(admin.password);

    const stored = await UserModel.findOne({ email: admin.email }).select('+passwordHash');
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored?.passwordHash).not.toBe(admin.password);
  });

  it('normalises the email address', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...user, email: '  User@Example.COM ' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('user@example.com');
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send(user);
    const res = await request(app).post('/api/auth/register').send(user);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, error: { code: 'EMAIL_ALREADY_REGISTERED' } });
  });

  it('rejects an unknown role and invalid fields with 422', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short', role: 'superadmin' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(['email', 'password', 'role']),
    );
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('content-type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MALFORMED_JSON');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(user);
  });

  it('returns a JWT with only the necessary claims', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ tokenType: 'Bearer', user: { email: user.email, role: 'user' } });

    const claims = jwt.decode(res.body.data.token) as Record<string, unknown>;
    expect(claims).toMatchObject({ sub: res.body.data.user.id, email: user.email, role: 'user' });
    expect(claims).not.toHaveProperty('password');
    expect(claims).not.toHaveProperty('passwordHash');
  });

  it('returns 401 for an invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'WrongPassw0rd' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 for an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'Whatever1' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me (JWT authentication)', () => {
  it('returns the authenticated user for a valid token', async () => {
    const token = await registerAndLogin(admin);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: admin.email, role: 'admin' });
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  it('returns 401 for a token signed with another secret', async () => {
    const forged = jwt.sign(
      { email: 'x@example.com', role: 'admin' },
      'a-completely-different-secret-value!!',
      {
        subject: new mongoose.Types.ObjectId().toString(),
        issuer: 'bpp-auth-service',
        audience: 'bpp-services',
      },
    );
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 when the account no longer exists', async () => {
    const token = await registerAndLogin(user);
    await UserModel.deleteMany({});
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

describe('infrastructure endpoints', () => {
  it('reports health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'auth-service' });
  });

  it('returns a consistent 404 envelope for unknown routes', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'ROUTE_NOT_FOUND' } });
  });

  it('propagates the x-request-id header', async () => {
    const res = await request(app).get('/health').set('x-request-id', 'trace-123');
    expect(res.headers['x-request-id']).toBe('trace-123');
  });
});
