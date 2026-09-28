import { Errors, ROLES, type AuthUser, type Role } from '@bpp/shared';
import jwt from 'jsonwebtoken';
import { config } from '../config';

interface AccessTokenClaims {
  sub: string;
  email: string;
  role: Role;
}

export const tokenService = {
  sign(user: AuthUser): string {
    return jwt.sign({ email: user.email, role: user.role }, config.jwt.secret, {
      subject: user.id,
      expiresIn: config.jwt.expiresIn,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      algorithm: 'HS256',
    });
  },

  verify(token: string): AccessTokenClaims {
    let payload: string | jwt.JwtPayload;
    try {
      payload = jwt.verify(token, config.jwt.secret, {
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
        algorithms: ['HS256'],
      });
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError)
        throw Errors.unauthorized('Token has expired', 'TOKEN_EXPIRED');
      throw Errors.unauthorized('Invalid token', 'INVALID_TOKEN');
    }

    if (typeof payload === 'string' || !payload.sub || !ROLES.includes(payload.role)) {
      throw Errors.unauthorized('Invalid token', 'INVALID_TOKEN');
    }
    return { sub: payload.sub, email: payload.email, role: payload.role };
  },
};
