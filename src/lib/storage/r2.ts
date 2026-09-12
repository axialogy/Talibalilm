import 'server-only';

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { reportError } from '@/lib/observability/report';

/**
 * Cloudflare R2.
 *
 * The bucket holds slide images and nothing else for now. Recordings do NOT
 * come here: a recording is made by the teacher's browser and saved to their
 * own computer, which is what the school asked for and what keeps the whole
 * feature free — see `useRecorder`.
 *
 * `server-only` at the top is load-bearing. R2 credentials are ordinary secrets
 * with full read and write over the bucket, and the one way they could leak is
 * a module like this being pulled into a Client Component's import graph. That
 * import now fails the build rather than shipping a key to the browser.
 *
 * Nothing here throws when R2 is unset. Like PayPal, Resend and Sentry, storage
 * is optional at runtime: unconfigured, slide upload says so plainly and the
 * rest of the class — the room, the video, the recording — carries on.
 */

const ACCOUNT = process.env.R2_ACCOUNT_ID?.trim() ?? '';
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID?.trim() ?? '';
const SECRET = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? '';
const BUCKET = process.env.R2_BUCKET?.trim() ?? '';

/** True once all four values are present. Screens check this and degrade. */
export const r2Configured = Boolean(ACCOUNT && ACCESS_KEY && SECRET && BUCKET);

let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      // R2 has no regions; 'auto' is what Cloudflare's own documentation uses.
      region: 'auto',
      endpoint: `https://${ACCOUNT}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET },
    });
  }
  return client;
}

/**
 * A URL the browser may PUT one object to, for a few minutes.
 *
 * The upload goes straight from the teacher's machine to Cloudflare rather than
 * through Vercel — a function that streams every slide would be paying for
 * bandwidth to do nothing but forward it. The signature pins the key and the
 * content type, so the URL cannot be reused for a different object.
 */
export async function signSlideUpload(
  key: string,
  contentType: string,
  seconds = 300,
): Promise<string | null> {
  if (!r2Configured) return null;
  try {
    return await getSignedUrl(
      s3(),
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: seconds },
    );
  } catch (error) {
    reportError('r2.signUpload', error, { key });
    return null;
  }
}

/**
 * A URL the browser may GET one object from, for a few minutes.
 *
 * Short-lived on purpose. The bucket itself stays private — there is no public
 * base URL anywhere in this codebase — so a slide is only ever reachable
 * through a signature minted after `can_read_slide()` said yes. A link that
 * escapes into a chat log stops working within the hour.
 */
export async function signSlideDownload(key: string, seconds = 3600): Promise<string | null> {
  if (!r2Configured) return null;
  try {
    return await getSignedUrl(s3(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
      expiresIn: seconds,
    });
  } catch (error) {
    reportError('r2.signDownload', error, { key });
    return null;
  }
}

/**
 * The first bytes of an object, and its true length, read server-side.
 *
 * This is what lets the upload go direct to Cloudflare without giving up the
 * rule that a file is judged by its bytes and never by its declared type. The
 * browser uploads, then the server reads a few bytes back with a ranged GET and
 * sniffs them; only then does a row appear. An object that turns out not to be
 * an image is deleted and never becomes a slide.
 *
 * The length comes from the response's Content-Range (`bytes 0-15/12345`), not
 * from the browser. A presigned PUT cannot cap what is actually sent, so the
 * size that reaches the database has to be measured here rather than believed.
 */
export async function readSlideHead(
  key: string,
  bytes = 16,
): Promise<{ head: Uint8Array; size: number } | null> {
  if (!r2Configured) return null;
  try {
    const result = await s3().send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key, Range: `bytes=0-${bytes - 1}` }),
    );
    const body = await result.Body?.transformToByteArray();
    if (!body) return null;

    // "bytes 0-15/12345" — the figure after the slash is the whole object.
    const total = Number(result.ContentRange?.split('/')[1]);
    const size = Number.isFinite(total) && total > 0 ? total : (result.ContentLength ?? 0);
    return { head: new Uint8Array(body), size };
  } catch (error) {
    reportError('r2.readHead', error, { key });
    return null;
  }
}

/** Remove one object. Used when a slide is deleted, and to clean up a rejected upload. */
export async function deleteSlideObject(key: string): Promise<boolean> {
  if (!r2Configured) return false;
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (error) {
    reportError('r2.delete', error, { key });
    return false;
  }
}
