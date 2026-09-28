import type { PassportData } from '@bpp/shared';
import { PassportModel, type PassportDocument } from '../models/passport.model';

export const passportRepository = {
  create(data: PassportData, createdBy: string): Promise<PassportDocument> {
    return PassportModel.create({ data, createdBy });
  },

  findById(id: string): Promise<PassportDocument | null> {
    return PassportModel.findById(id).exec();
  },

  async list(page: number, limit: number): Promise<{ items: PassportDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      PassportModel.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      PassportModel.countDocuments().exec(),
    ]);
    return { items, total };
  },

  replaceData(id: string, data: PassportData, updatedBy: string): Promise<PassportDocument | null> {
    return PassportModel.findByIdAndUpdate(id, { $set: { data, updatedBy } }, { new: true, runValidators: true }).exec();
  },

  deleteById(id: string): Promise<PassportDocument | null> {
    return PassportModel.findByIdAndDelete(id).exec();
  },
};
