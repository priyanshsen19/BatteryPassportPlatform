process.env.BOOTSTRAP_ADMIN_EMAIL = 'Owner@Example.com';
process.env.BOOTSTRAP_ADMIN_PASSWORD = 'OwnerPassw0rd';

import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { UserModel } from '../src/models/user.model';
import { ensureBootstrapAdmin } from '../src/services/bootstrap-admin';

let mongod: MongoMemoryServer;

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

describe('ensureBootstrapAdmin', () => {
  it('creates the configured admin account when it does not exist', async () => {
    await ensureBootstrapAdmin();

    const owner = await UserModel.findOne({ email: 'owner@example.com' }).select('+passwordHash');
    expect(owner?.role).toBe('admin');
    expect(await bcrypt.compare('OwnerPassw0rd', owner!.passwordHash!)).toBe(true);
  });

  it('promotes an existing account without touching its password', async () => {
    const originalHash = await bcrypt.hash('TheirOwnPassw0rd', 4);
    await UserModel.create({ email: 'owner@example.com', passwordHash: originalHash, role: 'user' });

    await ensureBootstrapAdmin();

    const owner = await UserModel.findOne({ email: 'owner@example.com' }).select('+passwordHash');
    expect(owner?.role).toBe('admin');
    expect(owner?.passwordHash).toBe(originalHash);
  });

  it('is idempotent', async () => {
    await ensureBootstrapAdmin();
    await ensureBootstrapAdmin();
    expect(await UserModel.countDocuments({ email: 'owner@example.com' })).toBe(1);
  });
});
