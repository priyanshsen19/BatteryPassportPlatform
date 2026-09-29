import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import { UserModel } from '../src/models/user.model';

const app = createApp();
let mongod: MongoMemoryServer;

async function signUp(email: string, role: 'admin' | 'user' = 'user') {
  const registered = await request(app).post('/api/auth/register').send({ email, password: 'Passw0rd123' });
  if (role === 'admin') await UserModel.updateOne({ email }, { $set: { role: 'admin' } });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Passw0rd123' });
  return { id: registered.body.data.user.id as string, token: login.body.data.token as string };
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

describe('GET /api/auth/users', () => {
  it('lists users with their roles and sign-in methods for admins, without password hashes', async () => {
    const admin = await signUp('admin@example.com', 'admin');
    await signUp('viewer@example.com');

    const res = await request(app).get('/api/auth/users').set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: 'viewer@example.com', role: 'user', signInMethods: ['password'] }),
      ]),
    );
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('$2');
  });

  it('filters by email and role', async () => {
    const admin = await signUp('admin@example.com', 'admin');
    await signUp('alice@example.com');
    await signUp('bob@example.com');

    const byEmail = await request(app)
      .get('/api/auth/users?q=ALI')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(byEmail.body.data.items.map((u: { email: string }) => u.email)).toEqual(['alice@example.com']);

    const admins = await request(app)
      .get('/api/auth/users?role=admin')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(admins.body.data.total).toBe(1);
  });

  it('is forbidden for users', async () => {
    const viewer = await signUp('viewer@example.com');
    const res = await request(app).get('/api/auth/users').set('Authorization', `Bearer ${viewer.token}`);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/auth/users/:id/role', () => {
  it('lets an admin promote a user, effective on their next request', async () => {
    const admin = await signUp('admin@example.com', 'admin');
    const viewer = await signUp('viewer@example.com');

    const res = await request(app)
      .patch(`/api/auth/users/${viewer.id}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: 'viewer@example.com', role: 'admin' });

    // The existing token now resolves to the new role.
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${viewer.token}`);
    expect(me.body.data.user.role).toBe('admin');
  });

  it.each(['developer', 'tester'] as const)('lets an admin assign the %s role', async (role) => {
    const admin = await signUp('admin@example.com', 'admin');
    const viewer = await signUp('viewer@example.com');

    const res = await request(app)
      .patch(`/api/auth/users/${viewer.id}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe(role);
  });

  it('does not let developers or testers manage roles', async () => {
    const developer = await signUp('dev@example.com');
    await UserModel.updateOne({ email: 'dev@example.com' }, { $set: { role: 'developer' } });
    const viewer = await signUp('viewer@example.com');

    const res = await request(app)
      .patch(`/api/auth/users/${viewer.id}/role`)
      .set('Authorization', `Bearer ${developer.token}`)
      .send({ role: 'admin' });
    expect(res.status).toBe(403);
  });

  it('lets an admin demote another admin', async () => {
    const admin = await signUp('admin@example.com', 'admin');
    const other = await signUp('other@example.com', 'admin');

    const res = await request(app)
      .patch(`/api/auth/users/${other.id}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'user' });
    expect(res.body.data.role).toBe('user');
  });

  it('does not let admins change their own role', async () => {
    const admin = await signUp('admin@example.com', 'admin');
    const res = await request(app)
      .patch(`/api/auth/users/${admin.id}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'user' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_CHANGE_OWN_ROLE');
  });

  it('is forbidden for users, including promoting themselves', async () => {
    const viewer = await signUp('viewer@example.com');
    const res = await request(app)
      .patch(`/api/auth/users/${viewer.id}/role`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(403);
    expect((await UserModel.findById(viewer.id))?.role).toBe('user');
  });

  it('validates the role and the user id', async () => {
    const admin = await signUp('admin@example.com', 'admin');
    const viewer = await signUp('viewer@example.com');
    const auth = { Authorization: `Bearer ${admin.token}` };

    const badRole = await request(app)
      .patch(`/api/auth/users/${viewer.id}/role`)
      .set(auth)
      .send({ role: 'owner' });
    const badId = await request(app).patch('/api/auth/users/not-an-id/role').set(auth).send({ role: 'user' });
    const missing = await request(app)
      .patch(`/api/auth/users/${new mongoose.Types.ObjectId()}/role`)
      .set(auth)
      .send({ role: 'user' });

    expect(badRole.status).toBe(422);
    expect(badId.status).toBe(400);
    expect(missing.status).toBe(404);
  });
});
