import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import { PassportModel } from '../src/models/passport.model';
import { RecordingPublisher, fakeVerifyToken, samplePassport } from './helpers';

const app = createApp({ publisher: new RecordingPublisher(), verifyToken: fakeVerifyToken });
const as = (role: 'admin' | 'developer' | 'tester' | 'user') => ({ Authorization: `Bearer ${role}-token` });
let mongod: MongoMemoryServer;

async function existingPassportId(): Promise<string> {
  const res = await request(app).post('/api/passports').set(as('admin')).send(samplePassport());
  return res.body.data.id as string;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await PassportModel.init();
});

afterEach(async () => {
  await PassportModel.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('developer role', () => {
  it('can create and update passports', async () => {
    const created = await request(app).post('/api/passports').set(as('developer')).send(samplePassport());
    expect(created.status).toBe(201);
    expect(created.body.data.createdBy).toBe('dev-1');

    const updated = await request(app)
      .put(`/api/passports/${created.body.data.id}`)
      .set(as('developer'))
      .send(samplePassport());
    expect(updated.status).toBe(200);
  });

  it('cannot delete passports', async () => {
    const id = await existingPassportId();
    const res = await request(app).delete(`/api/passports/${id}`).set(as('developer'));
    expect(res.status).toBe(403);
    expect(await PassportModel.countDocuments()).toBe(1);
  });
});

describe('tester role', () => {
  it('can list and read passports', async () => {
    const id = await existingPassportId();
    expect((await request(app).get('/api/passports').set(as('tester'))).status).toBe(200);
    expect((await request(app).get(`/api/passports/${id}`).set(as('tester'))).status).toBe(200);
  });

  it('cannot create, update or delete passports', async () => {
    const id = await existingPassportId();
    const create = await request(app).post('/api/passports').set(as('tester')).send(samplePassport('BP-T'));
    const update = await request(app).put(`/api/passports/${id}`).set(as('tester')).send(samplePassport());
    const remove = await request(app).delete(`/api/passports/${id}`).set(as('tester'));

    expect([create.status, update.status, remove.status]).toEqual([403, 403, 403]);
  });
});
