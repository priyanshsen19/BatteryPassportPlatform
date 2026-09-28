import { z } from 'zod';

// Categories and lifecycle statuses defined by the EU Battery Regulation (EU) 2023/1542.
export const BATTERY_CATEGORIES = ['EV', 'LMT', 'Industrial', 'SLI', 'Portable'] as const;
export const BATTERY_STATUSES = ['Original', 'Repurposed', 'Reused', 'Remanufactured', 'Waste'] as const;

export type BatteryCategory = (typeof BATTERY_CATEGORIES)[number];
export type BatteryStatus = (typeof BATTERY_STATUSES)[number];

const text = (max = 200) => z.string().trim().min(1, 'This field is required').max(max);
const number = (message: string) => z.number({ error: message });

export const hazardousSubstanceSchema = z.strictObject({
  substanceName: text(),
  chemicalFormula: text(100),
  casNumber: z
    .string()
    .trim()
    .regex(/^\d{2,7}-\d{2}-\d$/, 'Must be a CAS registry number, e.g. 21324-40-3'),
});

export const passportDataSchema = z.strictObject({
  generalInformation: z.strictObject({
    batteryIdentifier: text(100),
    batteryModel: z.strictObject({
      id: text(100),
      modelName: text(),
    }),
    batteryMass: number('Battery mass must be a number').positive('Battery mass must be greater than 0'),
    batteryCategory: z.enum(BATTERY_CATEGORIES, {
      error: `Battery category must be one of: ${BATTERY_CATEGORIES.join(', ')}`,
    }),
    batteryStatus: z.enum(BATTERY_STATUSES, {
      error: `Battery status must be one of: ${BATTERY_STATUSES.join(', ')}`,
    }),
    manufacturingDate: z.iso.date('Must be a date in YYYY-MM-DD format'),
    manufacturingPlace: text(),
    warrantyPeriod: text(50),
    manufacturerInformation: z.strictObject({
      manufacturerName: text(),
      manufacturerIdentifier: text(100),
    }),
  }),
  materialComposition: z.strictObject({
    batteryChemistry: text(100),
    criticalRawMaterials: z.array(text(100)).min(1, 'Add at least one critical raw material'),
    hazardousSubstances: z.array(hazardousSubstanceSchema),
  }),
  carbonFootprint: z.strictObject({
    totalCarbonFootprint: number('Total carbon footprint must be a number').nonnegative(
      'Total carbon footprint cannot be negative',
    ),
    measurementUnit: text(50),
    methodology: text(),
  }),
});

/** Body of POST /api/passports and PUT /api/passports/:id, as defined by the assignment. */
export const passportRequestSchema = z.strictObject({
  data: passportDataSchema,
});

export type PassportData = z.infer<typeof passportDataSchema>;
export type PassportRequest = z.infer<typeof passportRequestSchema>;

export interface PassportDto {
  id: string;
  data: PassportData;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}
