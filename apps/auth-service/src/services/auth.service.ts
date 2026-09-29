import bcrypt from 'bcrypt';
import { createHash, timingSafeEqual } from 'crypto';
import { Errors, type AuthUser, type LoginResult, type Role, type UserDto } from '@bpp/shared';
import { config, logger } from '../config';
import { toUserDto, type UserDocument } from '../models/user.model';
import { userRepository } from '../repositories/user.repository';
import { createGoogleVerifier } from './google.verifier';
import { tokenService } from './token.service';

// Compared against when the email is unknown, so response time does not reveal whether
// an account exists.
let dummyHash: string | undefined;
const getDummyHash = async () =>
  (dummyHash ??= await bcrypt.hash('timing-equalisation', config.bcryptSaltRounds));

const googleVerifier = config.google.clientId ? createGoogleVerifier(config.google.clientId) : null;

function toAuthUser(user: UserDocument): AuthUser {
  return { id: user.id as string, email: user.email, role: user.role };
}

function issueSession(user: UserDocument): LoginResult {
  const authUser = toAuthUser(user);
  return {
    token: tokenService.sign(authUser),
    tokenType: 'Bearer',
    expiresIn: String(config.jwt.expiresIn),
    user: authUser,
  };
}

/** Compares hashes of equal length so the check takes the same time for every guess. */
export function isValidAccessCode(code: string): boolean {
  const expected = config.adminAccessCode;
  if (!expected) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(code), digest(expected));
}

/**
 * A valid access code creates an `admin`. Without one, or with a wrong one, the account is a
 * `user`: registration never fails because of the code, and a requested `role` alone grants
 * nothing (`developer` and `tester` are assigned by admins on the User roles page).
 */
function registrationRole(accessCode: string | undefined): { role: Role; accessCodeRejected: boolean } {
  if (accessCode !== undefined && isValidAccessCode(accessCode)) {
    return { role: 'admin', accessCodeRejected: false };
  }
  return { role: 'user', accessCodeRejected: accessCode !== undefined };
}

export const authService = {
  /** Registers an account: `admin` with a valid access code, otherwise `user`. */
  async register(input: {
    email: string;
    password: string;
    role?: Role;
    accessCode?: string;
  }): Promise<{ user: UserDto; accessCodeRejected: boolean }> {
    const { role, accessCodeRejected } = registrationRole(input.accessCode);
    if (await userRepository.existsByEmail(input.email)) {
      throw Errors.conflict('EMAIL_ALREADY_REGISTERED', 'An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, config.bcryptSaltRounds);
    const user = await userRepository.create({
      email: input.email,
      passwordHash,
      role,
    });
    logger.info('User registered', { userId: user.id, role: user.role, accessCodeRejected });
    return { user: toUserDto(user), accessCodeRejected };
  },

  async login(input: { email: string; password: string }): Promise<LoginResult> {
    const user = await userRepository.findByEmailWithPassword(input.email);
    // Google-only accounts have no password hash and are rejected like an unknown email.
    const passwordMatches = await bcrypt.compare(
      input.password,
      user?.passwordHash ?? (await getDummyHash()),
    );

    if (!user || !user.passwordHash || !passwordMatches) {
      throw Errors.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    logger.info('User logged in', { userId: user.id, method: 'password' });
    return issueSession(user);
  },

  /**
   * Signs in with a Google ID token. A known Google account signs straight in; a verified
   * email that matches an existing account is linked to it (keeping its role); otherwise a
   * new account is created with the `user` role, so admin rights can never be self-granted.
   */
  async loginWithGoogle(idToken: string): Promise<LoginResult> {
    if (!googleVerifier) {
      throw Errors.serviceUnavailable('GOOGLE_AUTH_DISABLED', 'Google sign-in is not configured');
    }

    const identity = await googleVerifier.verify(idToken);
    if (!identity.emailVerified) {
      throw Errors.unauthorized('Your Google account email is not verified', 'GOOGLE_EMAIL_UNVERIFIED');
    }

    let user = await userRepository.findByGoogleId(identity.googleId);

    if (!user) {
      const existing = await userRepository.findByEmail(identity.email);
      if (existing?.googleId) {
        // The email belongs to an account already linked to a different Google account.
        throw Errors.conflict('ACCOUNT_LINKED_ELSEWHERE', 'This email is linked to another Google account');
      }
      if (existing) {
        user = await userRepository.linkGoogleAccount(existing.id as string, identity.googleId);
        logger.info('Google account linked', { userId: existing.id });
      } else {
        user = await userRepository.create({
          email: identity.email,
          googleId: identity.googleId,
          role: 'user',
        });
        logger.info('User registered', { userId: user.id, role: user.role, method: 'google' });
      }
    }

    if (!user) throw Errors.unauthorized('The account could not be found', 'INVALID_CREDENTIALS');
    logger.info('User logged in', { userId: user.id, method: 'google' });
    return issueSession(user);
  },

  /**
   * Verifies the token and re-reads the user, so deleted accounts or role changes take effect
   * immediately instead of trusting claims in an older token.
   */
  async authenticate(token: string): Promise<AuthUser> {
    const claims = tokenService.verify(token);
    const user = await userRepository.findById(claims.sub);
    if (!user) throw Errors.unauthorized('The account for this token no longer exists', 'INVALID_TOKEN');
    // A password reset ends every session that started before it.
    const changedAt = user.passwordChangedAt ? Math.floor(user.passwordChangedAt.getTime() / 1000) : 0;
    if (claims.iat !== undefined && claims.iat < changedAt) {
      throw Errors.unauthorized('Your password was changed. Please sign in again.', 'TOKEN_REVOKED');
    }
    return toAuthUser(user);
  },
};
