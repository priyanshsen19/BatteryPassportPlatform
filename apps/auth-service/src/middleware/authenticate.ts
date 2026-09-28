import { createAuthenticateJWT } from '@bpp/shared';
import { authService } from '../services/auth.service';

/** The auth service is the token issuer, so it verifies JWTs locally. */
export const authenticateJWT = createAuthenticateJWT((token) => authService.authenticate(token));
