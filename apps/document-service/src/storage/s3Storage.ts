import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Logger } from '@bpp/shared';
import type { ObjectStorage, PutObjectInput } from './objectStorage';

export interface S3StorageOptions {
  region: string;
  bucket: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
  endpoint?: string;
  publicEndpoint?: string;
  forcePathStyle: boolean;
  downloadUrlTtlSeconds: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The only S3 integration in the service. The same code talks to AWS S3 in production and to
 * LocalStack locally; only the endpoint configuration differs.
 */
export class S3Storage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly signingClient: S3Client;
  private ready = false;

  constructor(
    private readonly options: S3StorageOptions,
    private readonly logger: Logger,
    client?: S3Client,
  ) {
    const build = (endpoint?: string) =>
      new S3Client({
        region: options.region,
        credentials: options.credentials,
        endpoint,
        forcePathStyle: options.forcePathStyle,
      });

    this.client = client ?? build(options.endpoint);
    this.signingClient = options.publicEndpoint ? build(options.publicEndpoint) : this.client;
  }

  /** Confirms the (private, pre-provisioned) bucket is reachable before serving traffic. */
  async verifyBucket(retries = 10, delayMs = 3000): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: this.options.bucket }));
        this.ready = true;
        this.logger.info('S3 bucket is reachable', { bucket: this.options.bucket });
        return;
      } catch (err) {
        this.logger.warn('S3 bucket check failed', { attempt, retries, error: (err as Error).name });
        if (attempt === retries) throw err;
        await sleep(delayMs);
      }
    }
  }

  async putObject({ key, body, contentType }: PutObjectInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }));
  }

  async getDownloadUrl(key: string, fileName: string): Promise<{ url: string; expiresIn: number }> {
    const expiresIn = this.options.downloadUrlTtlSeconds;
    const command = new GetObjectCommand({
      Bucket: this.options.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    });
    const url = await getSignedUrl(this.signingClient, command, { expiresIn });
    return { url, expiresIn };
  }

  isReady(): boolean {
    return this.ready;
  }
}
