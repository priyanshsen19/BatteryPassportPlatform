import { DocumentModel, type DocumentAttributes, type DocumentRecord } from '../models/document.model';

type NewDocument = Omit<DocumentAttributes, 'createdAt' | 'updatedAt'>;
type MetadataChanges = Partial<Pick<DocumentAttributes, 'fileName' | 'passportId'>>;

export const documentRepository = {
  create(data: NewDocument): Promise<DocumentRecord> {
    return DocumentModel.create(data);
  },

  findById(id: string): Promise<DocumentRecord | null> {
    return DocumentModel.findById(id).exec();
  },

  async list(filter: { passportId?: string }, page: number, limit: number) {
    const query = filter.passportId ? { passportId: filter.passportId } : {};
    const [items, total] = await Promise.all([
      DocumentModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      DocumentModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  },

  updateMetadata(id: string, changes: MetadataChanges): Promise<DocumentRecord | null> {
    return DocumentModel.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true }).exec();
  },

  async deleteById(id: string): Promise<void> {
    await DocumentModel.deleteOne({ _id: id }).exec();
  },
};
