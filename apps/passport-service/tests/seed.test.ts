import { createLogger, passportRequestSchema } from '@bpp/shared';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PassportModel } from '../src/models/passport.model';
import { DEMO_PASSPORTS } from '../src/seed/demo-passports';
import { seedDemoPassports } from '../src/seed/seed-demo-data';

const logger = createLogger('test', { silent: true });
let mongod: MongoMemoryServer;

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

describe('demo passports', () => {
  it('are ten valid passport request bodies with unique identifiers', () => {
    expect(DEMO_PASSPORTS).toHaveLength(10);
    for (const data of DEMO_PASSPORTS) expect(passportRequestSchema.safeParse({ data }).success).toBe(true);
    const ids = new Set(DEMO_PASSPORTS.map((p) => p.generalInformation.batteryIdentifier));
    expect(ids.size).toBe(10);
  });

  it('are inserted once and existing records are left untouched', async () => {
    expect(await seedDemoPassports(logger)).toBe(10);

    await PassportModel.updateOne(
      { 'data.generalInformation.batteryIdentifier': 'BP-2024-011' },
      { 'data.generalInformation.batteryMass': 999 },
    );
    await PassportModel.deleteOne({ 'data.generalInformation.batteryIdentifier': 'BP-2024-012' });

    expect(await seedDemoPassports(logger)).toBe(1);
    expect(await PassportModel.countDocuments()).toBe(10);
    const edited = await PassportModel.findOne({
      'data.generalInformation.batteryIdentifier': 'BP-2024-011',
    });
    expect(edited?.data.generalInformation.batteryMass).toBe(999);
  });
});
