import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import { DocumentModel } from '../src/models/document.model';
import { InMemoryStorage, fakePassportClient, fakeVerifyToken } from './helpers';

const storage = new InMemoryStorage();
const app = createApp({ storage, passportClient: fakePassportClient, verifyToken: fakeVerifyToken });
const as = (role: 'admin' | 'developer' | 'tester') => ({ Authorization: `Bearer ${role}-token` });
let mongod: MongoMemoryServer;

const upload = (role: 'admin' | 'developer' | 'tester') =>
  request(app)
    .post('/api/documents/upload')
    .set(as(role))
    .attach('file', Buffer.from('%PDF-1.7 test'), { filename: 'report.pdf', contentType: 'application/pdf' });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await DocumentModel.init();
});

afterEach(async () => {
  await DocumentModel.deleteMany({});
  storage.objects.clear();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('developer role', () => {
  it('can upload and rename documents', async () => {
    const uploaded = await upload('developer');
    expect(uploaded.status).toBe(201);

    const renamed = await request(app)
      .put(`/api/documents/${uploaded.body.data.docId}`)
      .set(as('developer'))
      .send({ fileName: 'renamed.pdf' });
    expect(renamed.status).toBe(200);
  });

  it('cannot delete documents', async () => {
    const uploaded = await upload('admin');
    const res = await request(app).delete(`/api/documents/${uploaded.body.data.docId}`).set(as('developer'));
    expect(res.status).toBe(403);
    expect(storage.objects.size).toBe(1);
  });
});

describe('tester role', () => {
  it('can list documents and get download links', async () => {
    const uploaded = await upload('admin');
    expect((await request(app).get('/api/documents').set(as('tester'))).status).toBe(200);
    expect(
      (await request(app).get(`/api/documents/${uploaded.body.data.docId}`).set(as('tester'))).status,
    ).toBe(200);
  });

  it('can upload documents', async () => {
    expect((await upload('tester')).status).toBe(201);
  });

  it('cannot rename or delete documents', async () => {
    const uploaded = await upload('admin');
    const docId = uploaded.body.data.docId as string;

    const rename = await request(app)
      .put(`/api/documents/${docId}`)
      .set(as('tester'))
      .send({ fileName: 'x.pdf' });
    const remove = await request(app).delete(`/api/documents/${docId}`).set(as('tester'));

    expect([rename.status, remove.status]).toEqual([403, 403]);
  });
});
