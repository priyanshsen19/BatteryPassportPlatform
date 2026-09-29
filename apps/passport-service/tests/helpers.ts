import {
  AppError,
  createPassportEvent,
  type AuthUser,
  type PassportEvent,
  type PassportEventType,
  type PassportRequest,
  type TokenVerifier,
} from '@bpp/shared';
import type { PassportEventPublisher } from '../src/events/passportEventPublisher';

const ADMIN: AuthUser = { id: 'admin-1', email: 'admin@example.com', role: 'admin' };
const USER: AuthUser = { id: 'user-1', email: 'user@example.com', role: 'user' };
const DEVELOPER: AuthUser = { id: 'dev-1', email: 'dev@example.com', role: 'developer' };
const TESTER: AuthUser = { id: 'tester-1', email: 'tester@example.com', role: 'tester' };

/** Stands in for the auth service's GET /api/auth/me. */
export const fakeVerifyToken: TokenVerifier = async (token) => {
  if (token === 'admin-token') return ADMIN;
  if (token === 'user-token') return USER;
  if (token === 'developer-token') return DEVELOPER;
  if (token === 'tester-token') return TESTER;
  throw new AppError(401, 'INVALID_TOKEN', 'Invalid token');
};

export class RecordingPublisher implements PassportEventPublisher {
  events: PassportEvent[] = [];
  failNext = false;

  async publish(eventType: PassportEventType, passportId: string): Promise<PassportEvent> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('broker unavailable');
    }
    const event = createPassportEvent(eventType, passportId);
    this.events.push(event);
    return event;
  }

  isConnected(): boolean {
    return true;
  }
}

export function samplePassport(batteryIdentifier = 'BP-2024-011'): PassportRequest {
  return {
    data: {
      generalInformation: {
        batteryIdentifier,
        batteryModel: { id: 'LM3-BAT-2024', modelName: 'GMC WZX1' },
        batteryMass: 450,
        batteryCategory: 'EV',
        batteryStatus: 'Original',
        manufacturingDate: '2024-01-15',
        manufacturingPlace: 'Gigafactory Nevada',
        warrantyPeriod: '8',
        manufacturerInformation: { manufacturerName: 'Tesla Inc', manufacturerIdentifier: 'TESLA-001' },
      },
      materialComposition: {
        batteryChemistry: 'LiFePO4',
        criticalRawMaterials: ['Lithium', 'Iron'],
        hazardousSubstances: [
          { substanceName: 'Lithium Hexafluorophosphate', chemicalFormula: 'LiPF6', casNumber: '21324-40-3' },
        ],
      },
      carbonFootprint: {
        totalCarbonFootprint: 850,
        measurementUnit: 'kg CO2e',
        methodology: 'Life Cycle Assessment (LCA)',
      },
    },
  };
}
