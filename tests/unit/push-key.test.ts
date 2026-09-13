import { describe, expect, it } from 'vitest';
import { urlBase64ToUint8Array } from '@/lib/push/key';

/**
 * The VAPID key conversion.
 *
 * This is four lines of code and the most common single point of failure in a
 * Web Push setup, because every way it goes wrong looks like something else:
 * `atob` throws `InvalidCharacterError` on the base64url alphabet, and a key
 * that converts but is one byte short subscribes happily and then gets a 403
 * from the push service hours later, naming nothing.
 */
describe('urlBase64ToUint8Array', () => {
  it('decodes a real VAPID public key to the 65 bytes a P-256 point takes', () => {
    // A genuine uncompressed P-256 public key as web-push emits it: 87
    // base64url characters, 65 bytes, first byte 0x04 marking it uncompressed.
    const key =
      'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUAM-Ijv0UkVhjumkTI';
    const bytes = urlBase64ToUint8Array(key);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(0x04);
  });

  it('restores the padding base64url drops', () => {
    // 'Zm9vYmFy' is 'foobar' and needs no padding; 'Zm9v' -> 'foo' needs none
    // either, but 'Zg' -> 'f' needs '=='. All three must decode.
    expect(Array.from(urlBase64ToUint8Array('Zg'))).toEqual([0x66]);
    expect(Array.from(urlBase64ToUint8Array('Zm8'))).toEqual([0x66, 0x6f]);
    expect(Array.from(urlBase64ToUint8Array('Zm9v'))).toEqual([0x66, 0x6f, 0x6f]);
  });

  it('translates the URL-safe alphabet back to standard base64', () => {
    // 0xfb 0xff encodes as '+/8' in standard base64 and '-_8' in base64url.
    // Without the substitution atob would reject these characters outright.
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([0xfb, 0xff]);
  });

  it('ignores surrounding whitespace, which a pasted env var often carries', () => {
    expect(Array.from(urlBase64ToUint8Array('  Zm9v\n'))).toEqual([0x66, 0x6f, 0x6f]);
  });

  it('refuses an empty key rather than subscribing with nothing', () => {
    expect(() => urlBase64ToUint8Array('')).toThrow();
    expect(() => urlBase64ToUint8Array('   ')).toThrow();
  });
});
