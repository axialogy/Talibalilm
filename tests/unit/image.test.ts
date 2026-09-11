import { describe, expect, it } from 'vitest';
import { checkImage, MAX_IMAGE_BYTES, sniffImage } from '../../src/lib/media/image';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

describe('image sniffing (audit A6)', () => {
  it('recognises the three formats by their bytes, not their name', () => {
    expect(sniffImage(png)).toBe('png');
    expect(sniffImage(jpeg)).toBe('jpeg');
    expect(sniffImage(webp)).toBe('webp');
  });

  it('rejects a file that only claims to be an image', () => {
    // An HTML file a browser might mislabel as image/png. Trusting the label
    // here is a stored-XSS vector; reading the bytes is the whole point.
    const html = new TextEncoder().encode('<!doctype html><script>alert(1)</script>');
    expect(sniffImage(html)).toBeNull();
    expect(checkImage(html)).toEqual({ ok: false, error: 'notAnImage' });
  });

  it('accepts a real image and reports its type and extension', () => {
    expect(checkImage(png)).toMatchObject({ ok: true, kind: 'png', extension: 'png', contentType: 'image/png' });
    expect(checkImage(jpeg)).toMatchObject({ ok: true, extension: 'jpg' });
  });

  it('refuses anything over the size cap before looking at the bytes', () => {
    const huge = new Uint8Array(MAX_IMAGE_BYTES + 1);
    huge.set(png);
    expect(checkImage(huge)).toEqual({ ok: false, error: 'tooLarge' });
  });

  it('does not crash on a truncated header', () => {
    expect(sniffImage(new Uint8Array([0x89]))).toBeNull();
    expect(sniffImage(new Uint8Array([]))).toBeNull();
  });
});
