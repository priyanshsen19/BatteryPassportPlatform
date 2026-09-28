import { BATTERY_CATEGORIES, BATTERY_STATUSES, type PassportData, type PassportDto } from '@bpp/shared';
import { Schema, model, type HydratedDocument } from 'mongoose';

/** Same shape as the API model, except manufacturingDate is stored as a real Date. */
type StoredPassportData = Omit<PassportData, 'generalInformation'> & {
  generalInformation: Omit<PassportData['generalInformation'], 'manufacturingDate'> & {
    manufacturingDate: Date;
  };
};

export interface PassportAttributes {
  data: StoredPassportData;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PassportDocument = HydratedDocument<PassportAttributes>;

const requiredString = { type: String, required: true, trim: true };
const subSchema = (definition: Record<string, unknown>) => new Schema(definition, { _id: false });

const passportSchema = new Schema<PassportAttributes>(
  {
    data: {
      generalInformation: {
        type: subSchema({
          batteryIdentifier: requiredString,
          batteryModel: {
            type: subSchema({ id: requiredString, modelName: requiredString }),
            required: true,
          },
          batteryMass: { type: Number, required: true, min: 0 },
          batteryCategory: { type: String, enum: BATTERY_CATEGORIES, required: true },
          batteryStatus: { type: String, enum: BATTERY_STATUSES, required: true },
          manufacturingDate: { type: Date, required: true },
          manufacturingPlace: requiredString,
          warrantyPeriod: requiredString,
          manufacturerInformation: {
            type: subSchema({ manufacturerName: requiredString, manufacturerIdentifier: requiredString }),
            required: true,
          },
        }),
        required: true,
      },
      materialComposition: {
        type: subSchema({
          batteryChemistry: requiredString,
          criticalRawMaterials: { type: [String], default: [] },
          hazardousSubstances: {
            type: [
              subSchema({
                substanceName: requiredString,
                chemicalFormula: requiredString,
                casNumber: requiredString,
              }),
            ],
            default: [],
          },
        }),
        required: true,
      },
      carbonFootprint: {
        type: subSchema({
          totalCarbonFootprint: { type: Number, required: true, min: 0 },
          measurementUnit: requiredString,
          methodology: requiredString,
        }),
        required: true,
      },
    },
    // User ids issued by the auth service; users live in that service's database.
    createdBy: { type: String, required: true, index: true },
    updatedBy: { type: String },
  },
  { timestamps: true, collection: 'passports' },
);

passportSchema.index({ 'data.generalInformation.batteryIdentifier': 1 }, { unique: true });
passportSchema.index({ createdAt: -1 });

export const PassportModel = model<PassportAttributes>('Passport', passportSchema);

export function toPassportDto(passport: PassportDocument): PassportDto {
  const { data } = passport.toObject();
  const { generalInformation, materialComposition, carbonFootprint } = data;

  return {
    id: passport.id as string,
    data: {
      generalInformation: {
        ...generalInformation,
        manufacturingDate: generalInformation.manufacturingDate.toISOString().slice(0, 10),
      },
      materialComposition,
      carbonFootprint,
    },
    createdBy: passport.createdBy,
    ...(passport.updatedBy ? { updatedBy: passport.updatedBy } : {}),
    createdAt: passport.createdAt.toISOString(),
    updatedAt: passport.updatedAt.toISOString(),
  };
}
