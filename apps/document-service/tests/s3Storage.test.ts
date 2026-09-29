import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createLogger } from '@bpp/shared';
import { S3Storage, describeBucketError } from '../src/storage/s3Storage';
import { buildObjectKey, sanitizeFileName } from '../src/storage/objectKey';

const logger = createLogger('test', { silent: true });
const options = {
  region: 'eu-central-1',
  bucket: 'passport-docs',
  credentials: { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
  forcePathStyle: false,
  downloadUrlTtlSeconds: 300,
};

const s3Error = (status: number, headers: Record<string, string> = {}) =>
  Object.assign(new Error('UnknownError'), {
    name: 'Unknown',
    $metadata: { httpStatusCode: status },
    $response: { headers },
  });

describe('S3 bucket check', () => {
  it('names the bucket region when AWS_REGION is wrong (HTTP 301)', () => {
    const problem = describeBucketError(s3Error(301, { 'x-amz-bucket-region': 'eu-north-1' }), options);
    expect(problem.configuration).toBe(true);
    expect(problem.hint).toContain('is in region eu-north-1 but AWS_REGION is eu-central-1');
  });

  it.each([
    [403, 'access denied'],
    [404, 'does not exist'],
  ])('explains HTTP %i', (status, text) => {
    expect(describeBucketError(s3Error(status), options).hint).toContain(text);
  });

  it('treats network errors as transient', () => {
    expect(describeBucketError(new Error('ECONNREFUSED'), options).configuration).toBe(false);
  });

  it('fails immediately on a region mismatch instead of retrying', async () => {
    const client = new S3Client({ region: options.region, credentials: options.credentials });
    const send = jest
      .spyOn(client, 'send')
      .mockRejectedValue(s3Error(301, { 'x-amz-bucket-region': 'eu-north-1' }) as never);

    await expect(new S3Storage(options, logger, client).verifyBucket(10, 1)).rejects.toThrow(
      'set AWS_REGION=eu-north-1',
    );
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('retries transient failures and then succeeds', async () => {
    const client = new S3Client({ region: options.region, credentials: options.credentials });
    const send = jest
      .spyOn(client, 'send')
      .mockRejectedValueOnce(new Error('ECONNREFUSED') as never)
      .mockResolvedValueOnce({} as never);

    const storage = new S3Storage(options, logger, client);
    await storage.verifyBucket(3, 1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(storage.isReady()).toBe(true);
  });
});

describe('S3Storage', () => {
  it('sends PutObject with bucket, key, content type and server-side encryption', async () => {
    const client = new S3Client({ region: options.region, credentials: options.credentials });
    const send = jest.spyOn(client, 'send').mockResolvedValue({} as never);

    await new S3Storage(options, logger, client).putObject({
      key: 'documents/p1/uuid-file.pdf',
      body: Buffer.from('pdf'),
      contentType: 'application/pdf',
    });

    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'passport-docs',
      Key: 'documents/p1/uuid-file.pdf',
      ContentType: 'application/pdf',
      ServerSideEncryption: 'AES256',
    });
  });

  it('sends DeleteObject for the given key', async () => {
    const client = new S3Client({ region: options.region, credentials: options.credentials });
    const send = jest.spyOn(client, 'send').mockResolvedValue({} as never);

    await new S3Storage(options, logger, client).deleteObject('documents/p1/uuid-file.pdf');

    const command = send.mock.calls[0][0] as DeleteObjectCommand;
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({ Bucket: 'passport-docs', Key: 'documents/p1/uuid-file.pdf' });
  });

  it('generates a short-lived pre-signed GET URL', async () => {
    const storage = new S3Storage(options, logger);
    const { url, expiresIn } = await storage.getDownloadUrl('documents/p1/uuid-report.pdf', 'Report.pdf');

    const parsed = new URL(url);
    expect(expiresIn).toBe(300);
    expect(parsed.hostname).toBe('passport-docs.s3.eu-central-1.amazonaws.com');
    expect(parsed.pathname).toBe('/documents/p1/uuid-report.pdf');
    expect(parsed.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(parsed.searchParams.get('X-Amz-Signature')).toBeTruthy();
    expect(parsed.searchParams.get('response-content-disposition')).toContain('Report.pdf');
  });

  it('signs inline links for in-browser preview', async () => {
    const { url } = await new S3Storage(options, logger).getDownloadUrl(
      'documents/p1/a.pdf',
      'a.pdf',
      'inline',
    );
    expect(new URL(url).searchParams.get('response-content-disposition')).toMatch(/^inline;/);
  });

  it('signs URLs against the public endpoint when one is configured', async () => {
    const storage = new S3Storage(
      {
        ...options,
        endpoint: 'http://localstack:4566',
        publicEndpoint: 'http://localhost:4566',
        forcePathStyle: true,
      },
      logger,
    );
    const { url } = await storage.getDownloadUrl('documents/p1/a.pdf', 'a.pdf');
    expect(url.startsWith('http://localhost:4566/passport-docs/documents/p1/a.pdf')).toBe(true);
  });
});

describe('object keys', () => {
  it.each([
    ['report.pdf', 'report.pdf'],
    ['LCA Report (final).pdf', 'LCA-Report-final.pdf'],
    ['../../etc/passwd', 'passwd'],
    ['..\\..\\windows\\system.ini', 'system.ini'],
    ['Überprüfung.pdf', 'Uberprufung.pdf'],
    ['.hidden', 'hidden'],
    ['???', 'file'],
  ])('sanitizes %p to %p', (input, expected) => {
    expect(sanitizeFileName(input)).toBe(expected);
  });

  it('builds documents/{passportId}/{uuid}-{name}', () => {
    expect(buildObjectKey('a b.pdf', 'abc')).toMatch(/^documents\/abc\/[0-9a-f-]{36}-a-b\.pdf$/);
  });
});
