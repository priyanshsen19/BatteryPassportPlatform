import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import { DocumentModel } from '../src/models/document.model';
import { EXISTING_PASSPORT_ID, InMemoryStorage, fakePassportClient, fakeVerifyToken } from './helpers';

const ADMIN_AUTH = 'Bearer admin-token';
const USER_AUTH = 'Bearer user-token';
const PDF = Buffer.from('%PDF-1.7 battery certificate');

const storage = new InMemoryStorage();
const app = createApp({ storage, passportClient: fakePassportClient, verifyToken: fakeVerifyToken });
let mongod: MongoMemoryServer;

function upload(auth = ADMIN_AUTH, passportId: string | null = EXISTING_PASSPORT_ID) {
  const req = request(app)
    .post('/api/documents/upload')
    .set('Authorization', auth)
    .attach('file', PDF, { filename: 'LCA Report (final).pdf', contentType: 'application/pdf' });
  return passportId ? req.field('passportId', passportId) : req;
}

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

describe('POST /api/documents/upload', () => {
  it('stores the file in S3 and its metadata in MongoDB', async () => {
    const res = await upload();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(Object.keys(res.body.data).sort()).toEqual(['createdAt', 'docId', 'fileName']);
    expect(res.body.data.fileName).toBe('LCA Report (final).pdf');

    const saved = await DocumentModel.findById(res.body.data.docId);
    expect(saved).toMatchObject({
      mimeType: 'application/pdf',
      size: PDF.length,
      passportId: EXISTING_PASSPORT_ID,
      uploadedBy: 'admin-1',
    });
    expect(saved?.objectKey).toMatch(
      new RegExp(`^documents/${EXISTING_PASSPORT_ID}/[0-9a-f-]{36}-LCA-Report-final\\.pdf$`),
    );

    const stored = storage.objects.get(saved!.objectKey);
    expect(stored?.body.equals(PDF)).toBe(true);
    expect(stored?.contentType).toBe('application/pdf');
  });

  it('uses the "unassigned" prefix when no passport is linked', async () => {
    const res = await upload(ADMIN_AUTH, null);
    expect(res.status).toBe(201);
    const saved = await DocumentModel.findById(res.body.data.docId);
    expect(saved?.objectKey.startsWith('documents/unassigned/')).toBe(true);
    expect(saved?.passportId).toBeNull();
  });

  it('forbids users from uploading', async () => {
    const res = await upload(USER_AUTH);
    expect(res.status).toBe(403);
    expect(storage.objects.size).toBe(0);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/documents/upload');
    expect(res.status).toBe(401);
  });

  it('rejects a request without a file', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', ADMIN_AUTH)
      .field('passportId', EXISTING_PASSPORT_ID);
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('file');
  });

  it('rejects disallowed file types with 415', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', ADMIN_AUTH)
      .attach('file', Buffer.from('MZ'), { filename: 'tool.exe', contentType: 'application/x-msdownload' });
    expect(res.status).toBe(415);
  });

  it('rejects files over the size limit with 413', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', ADMIN_AUTH)
      .attach('file', Buffer.alloc(1024 * 1024 + 1), { filename: 'big.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(413);
  });

  it('rejects an unknown passport with 422', async () => {
    const res = await upload(ADMIN_AUTH, '6700f1c2a7d4e5f6012345ff');
    expect(res.status).toBe(422);
    expect(storage.objects.size).toBe(0);
  });

  it('returns 502 and saves no metadata when S3 fails', async () => {
    storage.failNextPut = true;
    const res = await upload();
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('STORAGE_ERROR');
    expect(await DocumentModel.countDocuments()).toBe(0);
  });
});

describe('GET /api/documents/:docId', () => {
  it('returns a pre-signed download URL to any authenticated role', async () => {
    const { body } = await upload();
    const res = await request(app).get(`/api/documents/${body.data.docId}`).set('Authorization', USER_AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data.expiresIn).toBe(300);
    expect(res.body.data.downloadUrl).toContain('X-Amz-Signature');
    expect(res.body.data.document.docId).toBe(body.data.docId);
    expect(res.body.data.disposition).toBe('attachment');
  });

  it('issues an inline preview link for PDFs', async () => {
    const { body } = await upload();
    const res = await request(app)
      .get(`/api/documents/${body.data.docId}?disposition=inline`)
      .set('Authorization', USER_AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data.disposition).toBe('inline');
    expect(res.body.data.downloadUrl).toContain('disposition=inline');
  });

  it('never issues inline links for types that are not previewable', async () => {
    const created = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', ADMIN_AUTH)
      .attach('file', Buffer.from('a,b\n1,2'), { filename: 'data.csv', contentType: 'text/csv' });

    const res = await request(app)
      .get(`/api/documents/${created.body.data.docId}?disposition=inline`)
      .set('Authorization', USER_AUTH);
    expect(res.body.data.disposition).toBe('attachment');
  });

  it('rejects an unknown disposition with 422', async () => {
    const { body } = await upload();
    const res = await request(app)
      .get(`/api/documents/${body.data.docId}?disposition=execute`)
      .set('Authorization', USER_AUTH);
    expect(res.status).toBe(422);
  });

  it('returns 404 for an unknown document', async () => {
    const res = await request(app)
      .get(`/api/documents/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', USER_AUTH);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('DOCUMENT_NOT_FOUND');
  });
});

describe('GET /api/documents', () => {
  it('lists documents filtered by passport', async () => {
    await upload();
    await upload(ADMIN_AUTH, null);

    const res = await request(app)
      .get(`/api/documents?passportId=${EXISTING_PASSPORT_ID}`)
      .set('Authorization', USER_AUTH);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
  });
});

describe('PUT /api/documents/:docId', () => {
  it('lets an admin rename a document without touching the stored object', async () => {
    const { body } = await upload();
    const before = await DocumentModel.findById(body.data.docId);

    const res = await request(app)
      .put(`/api/documents/${body.data.docId}`)
      .set('Authorization', ADMIN_AUTH)
      .send({ fileName: 'LCA report 2024.pdf' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ fileName: 'LCA report 2024.pdf', objectKey: before?.objectKey });
    expect(storage.objects.has(before!.objectKey)).toBe(true);
  });

  it('rejects an empty update with 422', async () => {
    const { body } = await upload();
    const res = await request(app)
      .put(`/api/documents/${body.data.docId}`)
      .set('Authorization', ADMIN_AUTH)
      .send({});
    expect(res.status).toBe(422);
  });

  it('forbids users from updating metadata', async () => {
    const { body } = await upload();
    const res = await request(app)
      .put(`/api/documents/${body.data.docId}`)
      .set('Authorization', USER_AUTH)
      .send({ fileName: 'x.pdf' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/documents/:docId', () => {
  it('deletes the S3 object and the metadata', async () => {
    const { body } = await upload();
    const saved = await DocumentModel.findById(body.data.docId);

    const res = await request(app)
      .delete(`/api/documents/${body.data.docId}`)
      .set('Authorization', ADMIN_AUTH);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ docId: body.data.docId });
    expect(storage.objects.has(saved!.objectKey)).toBe(false);
    expect(await DocumentModel.countDocuments()).toBe(0);
  });

  it('keeps the metadata when the S3 delete fails', async () => {
    const { body } = await upload();
    storage.failNextDelete = true;

    const res = await request(app)
      .delete(`/api/documents/${body.data.docId}`)
      .set('Authorization', ADMIN_AUTH);
    expect(res.status).toBe(502);
    expect(await DocumentModel.countDocuments()).toBe(1);
  });

  it('forbids users from deleting', async () => {
    const { body } = await upload();
    const res = await request(app)
      .delete(`/api/documents/${body.data.docId}`)
      .set('Authorization', USER_AUTH);
    expect(res.status).toBe(403);
  });
});
