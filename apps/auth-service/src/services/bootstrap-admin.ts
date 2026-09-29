import bcrypt from 'bcrypt';
import { config, logger } from '../config';
import { userRepository } from '../repositories/user.repository';

/**
 * Registration always creates `user` accounts, so the first administrator comes from
 * configuration: BOOTSTRAP_ADMIN_EMAIL (+ BOOTSTRAP_ADMIN_PASSWORD for a new account).
 * An existing account with that email is promoted; its password is never changed.
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  const { email, password } = config.bootstrapAdmin;
  if (!email) return;

  const existing = await userRepository.findByEmail(email);
  if (existing) {
    if (existing.role !== 'admin') {
      await userRepository.updateRole(existing.id as string, 'admin');
      logger.info('Bootstrap admin promoted', { userId: existing.id });
    }
    return;
  }

  if (!password) {
    logger.warn('BOOTSTRAP_ADMIN_EMAIL is set but no account exists and BOOTSTRAP_ADMIN_PASSWORD is empty');
    return;
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);
  const user = await userRepository.create({ email, passwordHash, role: 'admin' });
  logger.info('Bootstrap admin created', { userId: user.id });
}
