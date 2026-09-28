import { AppError, Errors, type AuthUser, type TokenVerifier } from '@bpp/shared';
import type { PassportClient } from '../src/clients/passportClient';
import type { ObjectStorage, PutObjectInput } from '../src/storage/objectStorage';

export const ADMIN: AuthUser = { id: 'admin-1', email: 'admin@example.com', role: 'admin' };
export const USER: AuthUser = { id: 'user-1', email: 'user@example.com', role: 'user' };

export const fakeVerifyToken: TokenVerifier = async (token) => {
  if (token === 'admin-token') return ADMIN;
  if (token === 'user-token') return USER;
  throw new AppError(401, 'INVALID_TOKEN', 'Invalid token');
};

/** In-memory bucket implementing the same interface as S3Storage. */
export class InMemoryStorage implements ObjectStorage {
  objects = new Map<string, { body: Buffer; contentType: string }>();
  failNextPut = false;
  failNextDelete = false;

  async putObject({ key, body, contentType }: PutObjectInput): Promise<void> {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new Error('S3 unavailable');
    }
    this.objects.set(key, { body, contentType });
  }

  async deleteObject(key: string): Promise<void> {
    if (this.failNextDelete) {
      this.failNextDelete = false;
      throw new Error('S3 unavailable');
    }
    this.objects.delete(key);
  }

  async getDownloadUrl(key: string): Promise<{ url: string; expiresIn: number }> {
    return { url: `https://test-bucket.s3.amazonaws.com/${key}?X-Amz-Signature=fake`, expiresIn: 300 };
  }

  isReady(): boolean {
    return true;
  }
}

export const EXISTING_PASSPORT_ID = '6700f1c2a7d4e5f601234567';

export const fakePassportClient: PassportClient = {
  async assertPassportExists(passportId) {
    if (passportId !== EXISTING_PASSPORT_ID) {
      throw Errors.validation([{ field: 'passportId', message: 'Battery passport does not exist' }]);
    }
  },
};
