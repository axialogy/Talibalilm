import { describe, expect, it } from 'vitest';
import { fitWithin, COVER_MAX_WIDTH } from '@/lib/media/downscale';

/**
 * The scaling arithmetic, without a canvas.
 *
 * The interesting case is the one that does NOT scale: an image already inside
 * the box must come back untouched. Scaling it "to fit" would enlarge it, which
 * turns a small sharp logo into a blurry one — a downgrade disguised as a
 * resize.
 */
describe('fitWithin', () => {
  it('leaves an image that already fits completely alone', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    // Exactly on the boundary is still inside it.
    expect(fitWithin(1600, 900, 1600)).toEqual({ width: 1600, height: 900 });
  });

  it('scales by the LONGEST side, so a tall image fits too', () => {
    // Portrait: it is the height that has to come down, not the width.
    expect(fitWithin(1200, 3200, 1600)).toEqual({ width: 600, height: 1600 });
    expect(fitWithin(3200, 1200, 1600)).toEqual({ width: 1600, height: 600 });
  });

  it('preserves the aspect ratio', () => {
    const { width, height } = fitWithin(4032, 3024, COVER_MAX_WIDTH);
    expect(width).toBe(1600);
    // 4:3 within a pixel of rounding.
    expect(Math.abs(height - 1200)).toBeLessThanOrEqual(1);
  });

  it('never rounds a dimension down to zero', () => {
    // A pathological banner: 10000x1 would scale its height to 0.16px, and a
    // canvas of height 0 throws rather than producing a thin image.
    const { width, height } = fitWithin(10000, 1, 1600);
    expect(width).toBe(1600);
    expect(height).toBeGreaterThanOrEqual(1);
  });

  it('refuses a degenerate size rather than dividing by it', () => {
    expect(fitWithin(0, 0, 1600)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(-5, 10, 1600)).toEqual({ width: 0, height: 0 });
  });
});
