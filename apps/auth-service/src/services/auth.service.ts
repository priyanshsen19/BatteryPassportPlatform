import bcrypt from 'bcrypt';
import { Errors, type AuthUser, type LoginResult, type Role, type UserDto } from '@bpp/shared';
import { config, logger } from '../config';
import { toUserDto } from '../models/user.model';
import { userRepository } from '../repositories/user.repository';
import { tokenService } from './token.service';

// Compared against when the email is unknown, so response time does not reveal whether
// an account exists.
let dummyHash: string | undefined;
const getDummyHash = async () =>
  (dummyHash ??= await bcrypt.hash('timing-equalisation', config.bcryptSaltRounds));

export const authService = {
  async register(input: { email: string; password: string; role: Role }): Promise<UserDto> {
    if (await userRepository.existsByEmail(input.email)) {
      throw Errors.conflict('EMAIL_ALREADY_REGISTERED', 'An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, config.bcryptSaltRounds);
    const user = await userRepository.create({ email: input.email, passwordHash, role: input.role });
    logger.info('User registered', { userId: user.id, role: user.role });
    return toUserDto(user);
  },

  async login(input: { email: string; password: string }): Promise<LoginResult> {
    const user = await userRepository.findByEmailWithPassword(input.email);
    const passwordMatches = await bcrypt.compare(
      input.password,
      user?.passwordHash ?? (await getDummyHash()),
    );

    if (!user || !passwordMatches) {
      throw Errors.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const authUser: AuthUser = { id: user.id as string, email: user.email, role: user.role };
    logger.info('User logged in', { userId: authUser.id });
    return {
      token: tokenService.sign(authUser),
      tokenType: 'Bearer',
      expiresIn: String(config.jwt.expiresIn),
      user: authUser,
    };
  },

  /**
   * Verifies the token and re-reads the user, so deleted accounts or role changes take effect
   * immediately instead of trusting claims in an older token.
   */
  async authenticate(token: string): Promise<AuthUser> {
    const claims = tokenService.verify(token);
    const user = await userRepository.findById(claims.sub);
    if (!user) throw Errors.unauthorized('The account for this token no longer exists', 'INVALID_TOKEN');
    return { id: user.id as string, email: user.email, role: user.role };
  },
};
