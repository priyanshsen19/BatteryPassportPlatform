import { passportEventSchema } from '@bpp/shared';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import { PassportModel } from '../src/models/passport.model';
import { RecordingPublisher, fakeVerifyToken, samplePassport } from './helpers';

const ADMIN_AUTH = 'Bearer admin-token';
const USER_AUTH = 'Bearer user-token';

const publisher = new RecordingPublisher();
const app = createApp({ publisher, verifyToken: fakeVerifyToken });
let mongod: MongoMemoryServer;

const createPassport = (body: object = samplePassport()) =>
  request(app).post('/api/passports').set('Authorization', ADMIN_AUTH).send(body);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await PassportModel.init();
});

afterEach(async () => {
  await PassportModel.deleteMany({});
  publisher.events = [];
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('authentication', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get(`/api/passports/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when the auth service rejects the token', async () => {
    const res = await request(app).get('/api/passports').set('Authorization', 'Bearer forged');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('POST /api/passports', () => {
  it('lets an admin create a passport and emits passport.created', async () => {
    const res = await createPassport();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ createdBy: 'admin-1', data: samplePassport().data });
    expect(mongoose.isValidObjectId(res.body.data.id)).toBe(true);

    expect(publisher.events).toHaveLength(1);
    const [event] = publisher.events;
    expect(passportEventSchema.parse(event)).toMatchObject({
      eventType: 'passport.created',
      version: 1,
      data: { passportId: res.body.data.id },
    });
  });

  it('forbids a user from creating a passport', async () => {
    const res = await request(app).post('/api/passports').set('Authorization', USER_AUTH).send(samplePassport());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
    expect(await PassportModel.countDocuments()).toBe(0);
    expect(publisher.events).toHaveLength(0);
  });

  it('rejects an invalid body with 422 and field-level details', async () => {
    const body = samplePassport();
    const invalid = {
      data: {
        ...body.data,
        generalInformation: { ...body.data.generalInformation, batteryCategory: 'Spaceship', batteryMass: -1 },
        carbonFootprint: undefined,
      },
    };

    const res = await createPassport(invalid);
    expect(res.status).toBe(422);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        'data.generalInformation.batteryCategory',
        'data.generalInformation.batteryMass',
        'data.carbonFootprint',
      ]),
    );
  });

  it('rejects unknown properties', async () => {
    const body = samplePassport();
    const res = await createPassport({ data: { ...body.data, injected: { $where: '1' } } });
    expect(res.status).toBe(422);
  });

  it('rejects a duplicate batteryIdentifier with 409', async () => {
    await createPassport();
    const res = await createPassport();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BATTERY_IDENTIFIER_EXISTS');
  });

  it('keeps the passport and logs when Kafka publishing fails', async () => {
    publisher.failNext = true;
    const res = await createPassport();
    expect(res.status).toBe(201);
    expect(await PassportModel.countDocuments()).toBe(1);
  });
});

describe('GET /api/passports/:id', () => {
  it('lets a user retrieve a passport in the original data format', async () => {
    const { body: created } = await createPassport();
    const res = await request(app).get(`/api/passports/${created.data.id}`).set('Authorization', USER_AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data.data).toEqual(samplePassport().data);
  });

  it('lets an admin retrieve a passport', async () => {
    const { body: created } = await createPassport();
    const res = await request(app).get(`/api/passports/${created.data.id}`).set('Authorization', ADMIN_AUTH);
    expect(res.status).toBe(200);
  });

  it('returns 404 for a missing passport', async () => {
    const res = await request(app)
      .get(`/api/passports/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', USER_AUTH);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PASSPORT_NOT_FOUND');
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app).get('/api/passports/not-an-id').set('Authorization', USER_AUTH);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ID');
  });
});

describe('GET /api/passports', () => {
  it('returns a paginated list for any role', async () => {
    await createPassport(samplePassport('BP-1'));
    await createPassport(samplePassport('BP-2'));

    const res = await request(app).get('/api/passports?limit=1').set('Authorization', USER_AUTH);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 1, limit: 1, total: 2 });
    expect(res.body.data.items).toHaveLength(1);
  });
});

describe('PUT /api/passports/:id', () => {
  it('lets an admin update a passport and emits passport.updated', async () => {
    const { body: created } = await createPassport();
    const updated = samplePassport();
    updated.data.generalInformation.batteryStatus = 'Repurposed';
    updated.data.carbonFootprint.totalCarbonFootprint = 790;

    const res = await request(app)
      .put(`/api/passports/${created.data.id}`)
      .set('Authorization', ADMIN_AUTH)
      .send(updated);

    expect(res.status).toBe(200);
    expect(res.body.data.data.generalInformation.batteryStatus).toBe('Repurposed');
    expect(res.body.data.data.carbonFootprint.totalCarbonFootprint).toBe(790);
    expect(res.body.data.updatedBy).toBe('admin-1');
    expect(publisher.events.map((e) => e.eventType)).toEqual(['passport.created', 'passport.updated']);
    expect(publisher.events[1].data.passportId).toBe(created.data.id);
  });

  it('forbids a user from updating a passport', async () => {
    const { body: created } = await createPassport();
    const res = await request(app)
      .put(`/api/passports/${created.data.id}`)
      .set('Authorization', USER_AUTH)
      .send(samplePassport());
    expect(res.status).toBe(403);
  });

  it('returns 404 when updating a missing passport', async () => {
    const res = await request(app)
      .put(`/api/passports/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', ADMIN_AUTH)
      .send(samplePassport());
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/passports/:id', () => {
  it('lets an admin delete a passport and emits passport.deleted', async () => {
    const { body: created } = await createPassport();
    const res = await request(app).delete(`/api/passports/${created.data.id}`).set('Authorization', ADMIN_AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: created.data.id });
    expect(await PassportModel.countDocuments()).toBe(0);
    expect(publisher.events.at(-1)).toMatchObject({
      eventType: 'passport.deleted',
      data: { passportId: created.data.id },
    });
  });

  it('forbids a user from deleting a passport', async () => {
    const { body: created } = await createPassport();
    const res = await request(app).delete(`/api/passports/${created.data.id}`).set('Authorization', USER_AUTH);
    expect(res.status).toBe(403);
    expect(await PassportModel.countDocuments()).toBe(1);
  });

  it('returns 404 when deleting a missing passport', async () => {
    const res = await request(app)
      .delete(`/api/passports/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', ADMIN_AUTH);
    expect(res.status).toBe(404);
  });
});
