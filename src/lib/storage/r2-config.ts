/**
 * The shape of the R2 variables, checked before anything is signed.
 *
 * The failure this exists for: `R2_ACCOUNT_ID` was given the whole S3 API URL
 * instead of the account id, so the endpoint became
 * `https://https://…r2.cloudflarestorage.com/talibalilm.r2.cloudflarestorage.com`
 * and every browser upload died with `ERR_NAME_NOT_RESOLVED` — while the
 * diagnostic could only say "fetch failed". A value that cannot be right is
 * worth naming on the screen before anyone goes looking for a bucket policy.
 *
 * Pure on purpose: the check is a fact about strings, and it is unit-tested
 * without an S3 client or a running server.
 */

/** Cloudflare account ids are 32 hexadecimal characters. */
export const R2_ACCOUNT_PATTERN = /^[0-9a-f]{32}$/i;

export function malformedR2Config(account: string, bucket: string): string[] {
  const bad: string[] = [];
  if (account && !R2_ACCOUNT_PATTERN.test(account)) bad.push('R2_ACCOUNT_ID');
  // A bucket is a name, never a URL or a path: `://`, a slash or a colon all
  // mean the S3 endpoint was pasted here instead.
  if (bucket && /[/:]/.test(bucket)) bad.push('R2_BUCKET');
  return bad;
}
