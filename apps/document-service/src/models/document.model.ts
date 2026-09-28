import type { DocumentDto } from '@bpp/shared';
import { Schema, model, type HydratedDocument } from 'mongoose';

export interface DocumentAttributes {
  fileName: string;
  objectKey: string;
  mimeType: string;
  size: number;
  passportId: string | null;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DocumentRecord = HydratedDocument<DocumentAttributes>;

const documentSchema = new Schema<DocumentAttributes>(
  {
    fileName: { type: String, required: true, trim: true, maxlength: 255 },
    objectKey: { type: String, required: true, unique: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
    // Passport ids belong to the passport service; stored as plain strings, no cross-database refs.
    passportId: { type: String, default: null },
    uploadedBy: { type: String, required: true },
  },
  { timestamps: true, collection: 'documents' },
);

documentSchema.index({ passportId: 1, createdAt: -1 });
documentSchema.index({ createdAt: -1 });

export const DocumentModel = model<DocumentAttributes>('Document', documentSchema);

export function toDocumentDto(doc: DocumentRecord): DocumentDto {
  return {
    docId: doc.id as string,
    fileName: doc.fileName,
    objectKey: doc.objectKey,
    mimeType: doc.mimeType,
    size: doc.size,
    passportId: doc.passportId ?? null,
    uploadedBy: doc.uploadedBy,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
