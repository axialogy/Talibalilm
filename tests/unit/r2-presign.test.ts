import { describe, expect, it } from 'vitest';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * The presigned URL must not carry a checksum.
 *
 * This is a regression test for a fault that was invisible from the browser and
 * cost a round of blaming a bucket policy that was correct.
 *
 * Recent AWS SDK versions add a CRC32 to S3 writes by default. When presigning
 * there is no body, so the SDK computes the checksum of NOTHING — `AAAAAA==`,
 * the CRC32 of zero bytes — and puts it in the query string. R2 then compares
 * the file the browser really sent against the checksum of an empty payload and
 * rejects every upload. The S3 error response carries no CORS headers, so the
 * browser reports it as an opaque `xhr.onerror` with no status and no message.
 *
 * `requestChecksumCalculation: 'WHEN_REQUIRED'` is what stops it. This test
 * exists so a future SDK bump that changes the default cannot put it back
 * without something going red.
 */
describe('the presigned upload URL', () => {
  const client = () =>
    new S3Client({
      region: 'auto',
      endpoint: 'https://account.r2.cloudflarestorage.com',
      credentials: { accessKeyId: 'AKIATEST', secretAccessKey: 'secret' },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

  it('carries no checksum parameters at all', async () => {
    const url = await getSignedUrl(
      client(),
      new PutObjectCommand({ Bucket: 'b', Key: 'lessons/a/b.mp4', ContentType: 'video/mp4' }),
      { expiresIn: 600 },
    );
    const params = [...new URL(url).searchParams.keys()];
    expect(params.filter((k) => k.toLowerCase().includes('checksum'))).toEqual([]);
  });

  it('still signs the request properly', async () => {
    // Removing the checksum must not remove the signature with it.
    const url = await getSignedUrl(
      client(),
      new PutObjectCommand({ Bucket: 'b', Key: 'lessons/a/b.mp4', ContentType: 'video/mp4' }),
      { expiresIn: 600 },
    );
    const q = new URL(url).searchParams;
    expect(q.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(q.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{16,}$/);
    expect(q.get('X-Amz-Expires')).toBe('600');
  });

  it('proves the DEFAULT would have broken it — the bug, reproduced', async () => {
    // No checksum options: this is what the code did before the fix.
    const naive = new S3Client({
      region: 'auto',
      endpoint: 'https://account.r2.cloudflarestorage.com',
      credentials: { accessKeyId: 'AKIATEST', secretAccessKey: 'secret' },
    });
    const url = await getSignedUrl(
      naive,
      new PutObjectCommand({ Bucket: 'b', Key: 'lessons/a/b.mp4', ContentType: 'video/mp4' }),
      { expiresIn: 600 },
    );
    const q = new URL(url).searchParams;
    // AAAAAA== is the CRC32 of zero bytes. If this assertion ever fails, the
    // SDK changed its default and the guard above may no longer be needed —
    // check before deleting it.
    expect(q.get('x-amz-checksum-crc32')).toBe('AAAAAA==');
  });
});
