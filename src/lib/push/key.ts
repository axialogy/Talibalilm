/**
 * The VAPID public key, in the shape `pushManager.subscribe` demands.
 *
 * The key is published as base64url — the URL-safe alphabet, no padding —
 * because it travels in headers and env vars. `applicationServerKey` wants raw
 * bytes. `atob` understands neither the `-`/`_` characters nor a missing `=`,
 * so it has to be converted first, and getting this wrong is the single most
 * common way this feature fails: the browser throws
 * `InvalidCharacterError` or, worse, subscribes with a key the push service
 * later rejects with a 403 that names nothing.
 *
 * Kept as its own module, with its own test, for exactly that reason.
 */
export function urlBase64ToUint8Array(base64UrlString: string): Uint8Array {
  const trimmed = base64UrlString.trim();
  if (trimmed === '') throw new Error('empty VAPID key');

  // Base64 encodes three bytes as four characters, so the length must be a
  // multiple of four; base64url drops the `=` that would have made it one.
  const padding = '='.repeat((4 - (trimmed.length % 4)) % 4);
  const base64 = (trimmed + padding).replace(/-/g, '+').replace(/_/g, '/');

  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
