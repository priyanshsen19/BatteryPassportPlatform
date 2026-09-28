import type { DownloadDisposition } from '@bpp/shared';

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

/** Storage operations the document service depends on; implemented by S3Storage. */
export interface ObjectStorage {
  putObject(input: PutObjectInput): Promise<void>;
  deleteObject(key: string): Promise<void>;
  getDownloadUrl(
    key: string,
    fileName: string,
    disposition?: DownloadDisposition,
  ): Promise<{ url: string; expiresIn: number }>;
  isReady(): boolean;
}
