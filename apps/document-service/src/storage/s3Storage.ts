import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { DownloadDisposition, Logger } from '@bpp/shared';
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

interface S3ErrorShape {
  name?: string;
  $metadata?: { httpStatusCode?: number };
  $response?: { headers?: Record<string, string | undefined> };
}

/**
 * HeadBucket responses carry no body, so the SDK often reports only "UnknownError". The HTTP
 * status (and S3's x-amz-bucket-region header) identify the actual misconfiguration.
 */
export function describeBucketError(
  err: unknown,
  options: Pick<S3StorageOptions, 'bucket' | 'region'>,
): { status?: number; bucketRegion?: string; configuration: boolean; hint: string } {
  const e = (err ?? {}) as S3ErrorShape;
  const status = e.$metadata?.httpStatusCode;
  const bucketRegion = e.$response?.headers?.['x-amz-bucket-region'];

  switch (status) {
    case 301:
      return {
        status,
        bucketRegion,
        configuration: true,
        hint: bucketRegion
          ? `bucket "${options.bucket}" is in region ${bucketRegion} but AWS_REGION is ${options.region}; set AWS_REGION=${bucketRegion}`
          : `bucket "${options.bucket}" is not in region ${options.region}; set AWS_REGION to the bucket's region`,
      };
    case 400:
      return {
        status,
        bucketRegion,
        configuration: true,
        hint: `S3 rejected the request; check AWS_REGION (${options.region}) matches the bucket's region`,
      };
    case 403:
      return {
        status,
        configuration: true,
        hint: `access denied to bucket "${options.bucket}"; check AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY and that the IAM policy allows s3:ListBucket on the bucket`,
      };
    case 404:
      return {
        status,
        configuration: true,
        hint: `bucket "${options.bucket}" does not exist; check AWS_S3_BUCKET`,
      };
    default:
      return {
        status,
        configuration: false,
        hint: `${e.name ?? 'Error'}${status ? ` (HTTP ${status})` : ''}: S3 is not reachable yet`,
      };
  }
}

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

  /**
   * Confirms the (private, pre-provisioned) bucket is reachable before serving traffic.
   * Network errors and 5xx responses are retried (e.g. LocalStack still starting); 301/400/403/404
   * are configuration problems, so they fail immediately with an explanation.
   */
  async verifyBucket(retries = 10, delayMs = 3000): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: this.options.bucket }));
        this.ready = true;
        this.logger.info('S3 bucket is reachable', {
          bucket: this.options.bucket,
          region: this.options.region,
        });
        return;
      } catch (err) {
        const problem = describeBucketError(err, this.options);
        this.logger.warn('S3 bucket check failed', { attempt, retries, ...problem });
        if (problem.configuration || attempt === retries) {
          throw new Error(`S3 bucket check failed: ${problem.hint}`);
        }
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

  async getDownloadUrl(
    key: string,
    fileName: string,
    disposition: DownloadDisposition = 'attachment',
  ): Promise<{ url: string; expiresIn: number }> {
    const expiresIn = this.options.downloadUrlTtlSeconds;
    const command = new GetObjectCommand({
      Bucket: this.options.bucket,
      Key: key,
      ResponseContentDisposition: `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    });
    const url = await getSignedUrl(this.signingClient, command, { expiresIn });
    return { url, expiresIn };
  }

  isReady(): boolean {
    return this.ready;
  }
}
