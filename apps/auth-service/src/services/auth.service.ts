import bcrypt from 'bcrypt';
import { Errors, type AuthUser, type LoginResult, type UserDto } from '@bpp/shared';
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

export const authService = {
  /** Every self-registered account starts as a `user`; only an admin can promote it. */
  async register(input: { email: string; password: string }): Promise<UserDto> {
    if (await userRepository.existsByEmail(input.email)) {
      throw Errors.conflict('EMAIL_ALREADY_REGISTERED', 'An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, config.bcryptSaltRounds);
    const user = await userRepository.create({ email: input.email, passwordHash, role: 'user' });
    logger.info('User registered', { userId: user.id, role: user.role });
    return toUserDto(user);
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
    return toAuthUser(user);
  },
};
