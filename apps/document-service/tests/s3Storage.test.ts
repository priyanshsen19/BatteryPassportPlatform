import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createLogger } from '@bpp/shared';
import { S3Storage } from '../src/storage/s3Storage';
import { buildObjectKey, sanitizeFileName } from '../src/storage/objectKey';

const logger = createLogger('test', { silent: true });
const options = {
  region: 'eu-central-1',
  bucket: 'passport-docs',
  credentials: { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
  forcePathStyle: false,
  downloadUrlTtlSeconds: 300,
};

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
