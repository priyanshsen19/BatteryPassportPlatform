import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Errors } from '@bpp/shared';
import { config, logger } from '../config';
import { userRepository } from '../repositories/user.repository';
import { mailer } from './mailer';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const passwordResetService = {
  /**
   * Emails a single-use reset link. The response never reveals whether the email is registered;
   * only a hash of the token is stored, and a newer request replaces an older link.
   */
  async requestReset(email: string): Promise<void> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      logger.info('Password reset requested for an unknown email');
      return;
    }

    const token = randomBytes(32).toString('base64url');
    const { ttlMinutes, appUrl } = config.passwordReset;
    await userRepository.setPasswordResetToken(
      user.id as string,
      hashToken(token),
      new Date(Date.now() + ttlMinutes * 60_000),
    );

    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    try {
      await mailer.sendPasswordReset({ to: user.email, resetUrl, expiresInMinutes: ttlMinutes });
    } catch (err) {
      // Same response either way; the failure is visible to operators in the log.
      logger.error('Password reset email could not be sent', {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    logger.info('Password reset requested', { userId: user.id });
  },

  /** Sets a new password from a valid link. Existing sessions are signed out. */
  async resetPassword(token: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);
    const user = await userRepository.resetPasswordWithToken(hashToken(token), passwordHash);
    if (!user) {
      throw Errors.badRequest(
        'This reset link is invalid or has expired. Request a new one.',
        'INVALID_RESET_TOKEN',
      );
    }
    logger.info('Password reset completed', { userId: user.id });
  },
};
