import type { PassportData, PassportListQuery, PassportSortField } from '@bpp/shared';
import type { FilterQuery, SortOrder } from 'mongoose';
import { PassportModel, type PassportAttributes, type PassportDocument } from '../models/passport.model';

const GENERAL = 'data.generalInformation';

const SORT_PATHS: Record<PassportSortField, string> = {
  createdAt: 'createdAt',
  batteryIdentifier: `${GENERAL}.batteryIdentifier`,
  modelName: `${GENERAL}.batteryModel.modelName`,
  batteryCategory: `${GENERAL}.batteryCategory`,
  batteryStatus: `${GENERAL}.batteryStatus`,
  manufacturerName: `${GENERAL}.manufacturerInformation.manufacturerName`,
  manufacturingDate: `${GENERAL}.manufacturingDate`,
};

const SEARCH_PATHS = [
  `${GENERAL}.batteryIdentifier`,
  `${GENERAL}.batteryModel.modelName`,
  `${GENERAL}.batteryModel.id`,
  `${GENERAL}.manufacturerInformation.manufacturerName`,
];

/** User input is matched literally, never interpreted as a regular expression. */
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildFilter({ q, category, status }: PassportListQuery): FilterQuery<PassportAttributes> {
  const filter: Record<string, unknown> = {};
  if (category) filter[`${GENERAL}.batteryCategory`] = category;
  if (status) filter[`${GENERAL}.batteryStatus`] = status;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = SEARCH_PATHS.map((path) => ({ [path]: pattern }));
  }
  return filter;
}

export const passportRepository = {
  create(data: PassportData, createdBy: string): Promise<PassportDocument> {
    return PassportModel.create({ data, createdBy });
  },

  findById(id: string): Promise<PassportDocument | null> {
    return PassportModel.findById(id).exec();
  },

  async list(query: PassportListQuery): Promise<{ items: PassportDocument[]; total: number }> {
    const filter = buildFilter(query);
    const direction: SortOrder = query.order === 'asc' ? 1 : -1;
    // _id as a tie-breaker keeps pagination stable when sort values are equal.
    const sort: Record<string, SortOrder> = { [SORT_PATHS[query.sort]]: direction, _id: direction };

    const [items, total] = await Promise.all([
      PassportModel.find(filter)
        .collation({ locale: 'en', strength: 2 })
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      PassportModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  },

  replaceData(id: string, data: PassportData, updatedBy: string): Promise<PassportDocument | null> {
    return PassportModel.findByIdAndUpdate(
      id,
      { $set: { data, updatedBy } },
      { new: true, runValidators: true },
    ).exec();
  },

  deleteById(id: string): Promise<PassportDocument | null> {
    return PassportModel.findByIdAndDelete(id).exec();
  },
};
