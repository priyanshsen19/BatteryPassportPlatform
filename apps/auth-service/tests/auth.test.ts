import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import { UserModel } from '../src/models/user.model';

const app = createApp();
let mongod: MongoMemoryServer;

const ACCESS_CODE = 'test-access-code-2026';
const admin = { email: 'admin@example.com', password: 'AdminPassw0rd', accessCode: ACCESS_CODE };
const user = { email: 'user@example.com', password: 'UserPassw0rd' };

async function registerAndLogin(account: { email: string; password: string }): Promise<string> {
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
    expect(res.body).toMatchObject({ success: true, data: { user: { email: admin.email } } });
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

  it('registers an admin with a valid access code', async () => {
    const res = await request(app).post('/api/auth/register').send(admin);

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('admin');
    expect((await UserModel.findOne({ email: admin.email }))?.role).toBe('admin');
  });

  it('never grants developer or tester at registration, even with a valid code', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...user, role: 'tester', accessCode: ACCESS_CODE });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('admin');
  });

  it.each(['admin', 'developer', 'tester'])('ignores role %s without an access code', async (role) => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...user, role });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('user');
  });

  it('creates a user when the access code is wrong', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...user, role: 'admin', accessCode: 'not-the-right-code' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('user');
  });

  it('treats an empty access code as none', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...user, accessCode: '  ' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('user');
  });

  it('defaults to the user role when none is given', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'plain@example.com', password: 'PlainPassw0rd' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('user');
  });

  it('rejects an unknown role with 422', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...user, role: 'superuser' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid fields with 422', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(['email', 'password']),
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

describe('POST /api/auth/access-code/verify', () => {
  const verify = (accessCode: string) =>
    request(app).post('/api/auth/access-code/verify').send({ accessCode });

  it('accepts the configured code', async () => {
    const res = await verify(ACCESS_CODE);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ valid: true });
  });

  it('rejects a wrong code with 403 and creates nothing', async () => {
    const res = await verify('wrong-code');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_ACCESS_CODE');
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it('requires a code', async () => {
    const res = await request(app).post('/api/auth/access-code/verify').send({});
    expect(res.status).toBe(422);
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
    const token = await registerAndLogin(user);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: user.email, role: 'user' });
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
