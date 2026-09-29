import { Errors, type AuthUser, type ManagedUserDto, type Paginated, type Role } from '@bpp/shared';
import { logger } from '../config';
import { toManagedUserDto } from '../models/user.model';
import { userRepository } from '../repositories/user.repository';

/** User and role management, available to admins only (enforced by the routes). */
export const userAdminService = {
  async list(
    filter: { q?: string; role?: Role },
    page: number,
    limit: number,
  ): Promise<Paginated<ManagedUserDto>> {
    const { items, total } = await userRepository.list(filter, page, limit);
    return { items: items.map(toManagedUserDto), page, limit, total };
  },

  /**
   * Changes another user's role. Admins cannot change their own role, which also guarantees
   * the platform always keeps at least one admin. The change applies to the user's very next
   * request, because every token is re-checked against the stored role.
   */
  async changeRole(
    targetId: string,
    role: Role,
    actor: AuthUser,
    requestId: string,
  ): Promise<ManagedUserDto> {
    if (targetId === actor.id) {
      throw Errors.badRequest('You cannot change your own role', 'CANNOT_CHANGE_OWN_ROLE');
    }

    const user = await userRepository.updateRole(targetId, role);
    if (!user) throw Errors.notFound('USER_NOT_FOUND', `User ${targetId} not found`);

    logger.info('User role changed', { userId: targetId, role, changedBy: actor.id, requestId });
    return toManagedUserDto(user);
  },
};
