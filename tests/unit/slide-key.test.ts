import { describe, expect, it } from 'vitest';
import {
  isSlideKeyFor,
  safeFilename,
  slideKey,
  slideName,
  SLIDE_KEY_PATTERN,
} from '@/lib/storage/key';

const SESSION = '11110000-0000-4000-8000-000000000001';
const OTHER = '11110000-0000-4000-8000-000000000002';

describe('slideKey', () => {
  it('files a slide under its own class', () => {
    expect(slideKey(SESSION, 'png', 'abcd1234efgh')).toBe(`live/${SESSION}/abcd1234efgh.png`);
  });

  it('produces a key the database constraint accepts', () => {
    // The CHECK in 20260912170000_live_slides.sql demands this exact shape; a
    // key that fails here would be refused on insert with no useful message.
    expect(SLIDE_KEY_PATTERN.test(slideKey(SESSION, 'png', slideName()))).toBe(true);
    expect(SLIDE_KEY_PATTERN.test(slideKey(SESSION, 'jpg', slideName()))).toBe(true);
    expect(SLIDE_KEY_PATTERN.test(slideKey(SESSION, 'webp', slideName()))).toBe(true);
  });

  it('names objects unpredictably', () => {
    const names = new Set(Array.from({ length: 50 }, () => slideName()));
    expect(names.size).toBe(50);
    expect(slideName()).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('isSlideKeyFor', () => {
  it('accepts a key this session actually owns', () => {
    expect(isSlideKeyFor(`live/${SESSION}/abcd1234efgh.png`, SESSION)).toBe(true);
  });

  it('refuses another class’s object', () => {
    expect(isSlideKeyFor(`live/${OTHER}/abcd1234efgh.png`, SESSION)).toBe(false);
  });

  it('refuses an attempt to walk out of the prefix', () => {
    expect(isSlideKeyFor(`live/${SESSION}/../../secrets.png`, SESSION)).toBe(false);
    expect(isSlideKeyFor(`live/${SESSION}/..%2Fsecrets.png`, SESSION)).toBe(false);
    expect(isSlideKeyFor(`../live/${SESSION}/abcd1234efgh.png`, SESSION)).toBe(false);
  });

  it('refuses anything a browser would execute', () => {
    expect(isSlideKeyFor(`live/${SESSION}/payload12.html`, SESSION)).toBe(false);
    expect(isSlideKeyFor(`live/${SESSION}/payload12.svg`, SESSION)).toBe(false);
    expect(isSlideKeyFor(`live/${SESSION}/payload12.png.html`, SESSION)).toBe(false);
  });

  it('refuses a key for a session id that is not one', () => {
    expect(isSlideKeyFor('live/not-a-uuid/abcd1234efgh.png', 'not-a-uuid')).toBe(false);
  });
});

describe('safeFilename', () => {
  it('keeps only the name the teacher would recognise', () => {
    expect(safeFilename('C:\\Users\\Youcef\\Desktop\\plan.png')).toBe('plan.png');
    expect(safeFilename('/etc/passwd')).toBe('passwd');
    expect(safeFilename('../../slide 1.png')).toBe('slide 1.png');
  });

  it('strips control characters and bounds the length', () => {
    expect(safeFilename('pl\u0000an\u001f.png')).toBe('plan.png');
    expect(safeFilename('a'.repeat(300)).length).toBe(120);
  });
});
