import { AppError, Errors } from '@bpp/shared';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
}

export interface GoogleVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

/**
 * Verifies Google ID tokens with Google's official library: signature against Google's
 * published keys, issuer, expiry, and that the token was issued for our OAuth client.
 */
export function createGoogleVerifier(clientId: string): GoogleVerifier {
  const client = new OAuth2Client(clientId);

  return {
    async verify(idToken) {
      try {
        const ticket = await client.verifyIdToken({ idToken, audience: clientId });
        const payload = ticket.getPayload();
        if (!payload?.sub || !payload.email) {
          throw Errors.unauthorized('Google did not return an email address', 'INVALID_GOOGLE_TOKEN');
        }
        return {
          googleId: payload.sub,
          email: payload.email.toLowerCase(),
          emailVerified: payload.email_verified === true,
        };
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw Errors.unauthorized('Invalid Google credential', 'INVALID_GOOGLE_TOKEN');
      }
    },
  };
}
