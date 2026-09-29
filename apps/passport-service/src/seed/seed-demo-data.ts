import type { Logger } from '@bpp/shared';
import { PassportModel } from '../models/passport.model';
import { DEMO_PASSPORTS } from './demo-passports';

export const DEMO_CREATED_BY = 'demo-seed';

/**
 * Inserts any sample passport whose battery identifier is not in the database yet. Safe to run on
 * every start: existing records (including edited or deleted-and-recreated ones) are never changed.
 * No Kafka events are published for sample data.
 */
export async function seedDemoPassports(logger: Logger): Promise<number> {
  const result = await PassportModel.bulkWrite(
    DEMO_PASSPORTS.map((data) => ({
      updateOne: {
        filter: { 'data.generalInformation.batteryIdentifier': data.generalInformation.batteryIdentifier },
        update: {
          $setOnInsert: {
            data: {
              ...data,
              generalInformation: {
                ...data.generalInformation,
                manufacturingDate: new Date(data.generalInformation.manufacturingDate),
              },
            },
            createdBy: DEMO_CREATED_BY,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false, timestamps: true },
  );
  logger.info('Demo passports seeded', { inserted: result.upsertedCount, total: DEMO_PASSPORTS.length });
  return result.upsertedCount;
}
