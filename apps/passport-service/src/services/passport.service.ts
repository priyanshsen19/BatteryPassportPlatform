import {
  Errors,
  type AuthUser,
  type Paginated,
  type PassportData,
  type PassportDto,
  type PassportEventType,
  type PassportListQuery,
} from '@bpp/shared';
import { logger } from '../config';
import type { PassportEventPublisher } from '../events/passportEventPublisher';
import { toPassportDto, type PassportDocument } from '../models/passport.model';
import { passportRepository } from '../repositories/passport.repository';

export interface RequestContext {
  user: AuthUser;
  requestId: string;
}

const notFound = () => Errors.notFound('PASSPORT_NOT_FOUND', 'Battery passport not found');

const isDuplicateKeyError = (err: unknown) => (err as { code?: number } | null)?.code === 11000;

const duplicateIdentifier = (data: PassportData) =>
  Errors.conflict(
    'BATTERY_IDENTIFIER_EXISTS',
    `A passport with batteryIdentifier '${data.generalInformation.batteryIdentifier}' already exists`,
  );

async function withDuplicateCheck<T>(data: PassportData, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (isDuplicateKeyError(err)) throw duplicateIdentifier(data);
    throw err;
  }
}

export function createPassportService(publisher: PassportEventPublisher) {
  /**
   * Runs after the database write has committed. A broker failure is logged at error level
   * with the full event context so it can be replayed, but does not undo the committed change.
   */
  async function emit(eventType: PassportEventType, passportId: string, requestId: string): Promise<void> {
    try {
      await publisher.publish(eventType, passportId, requestId);
    } catch (err) {
      logger.error('Failed to publish passport event', {
        eventType,
        passportId,
        requestId,
        error: (err as Error).message,
      });
    }
  }

  return {
    async create(data: PassportData, ctx: RequestContext): Promise<PassportDto> {
      const passport = await withDuplicateCheck(data, () => passportRepository.create(data, ctx.user.id));
      logger.info('Passport created', { passportId: passport.id, requestId: ctx.requestId });
      await emit('passport.created', passport.id as string, ctx.requestId);
      return toPassportDto(passport);
    },

    async getById(id: string): Promise<PassportDto> {
      const passport = await passportRepository.findById(id);
      if (!passport) throw notFound();
      return toPassportDto(passport);
    },

    async list(query: PassportListQuery): Promise<Paginated<PassportDto>> {
      const { items, total } = await passportRepository.list(query);
      return { items: items.map(toPassportDto), page: query.page, limit: query.limit, total };
    },

    async update(id: string, data: PassportData, ctx: RequestContext): Promise<PassportDto> {
      const passport: PassportDocument | null = await withDuplicateCheck(data, () =>
        passportRepository.replaceData(id, data, ctx.user.id),
      );
      if (!passport) throw notFound();

      logger.info('Passport updated', { passportId: id, requestId: ctx.requestId });
      await emit('passport.updated', id, ctx.requestId);
      return toPassportDto(passport);
    },

    async remove(id: string, ctx: RequestContext): Promise<{ id: string }> {
      const passport = await passportRepository.deleteById(id);
      if (!passport) throw notFound();

      logger.info('Passport deleted', { passportId: id, requestId: ctx.requestId });
      await emit('passport.deleted', id, ctx.requestId);
      return { id };
    },
  };
}

export type PassportService = ReturnType<typeof createPassportService>;
