import { describe, expect, it } from 'vitest';
import { socialHref, socialLinks, whatsappHref } from '@/lib/content/social';

describe('socialHref', () => {
  it('keeps a full URL as it is', () => {
    expect(socialHref('facebook', 'https://facebook.com/institut.talibalim')).toBe(
      'https://facebook.com/institut.talibalim',
    );
  });

  it('builds a URL from a bare handle, with or without the @', () => {
    expect(socialHref('instagram', 'talibalim')).toBe('https://instagram.com/talibalim');
    expect(socialHref('instagram', '@talibalim')).toBe('https://instagram.com/talibalim');
    expect(socialHref('tiktok', '@talibalim')).toBe('https://tiktok.com/@talibalim');
  });

  it('treats the bare platform home page as unset', () => {
    // These are the placeholders the repository shipped. A link to Facebook's
    // front door is not "our Facebook page".
    expect(socialHref('facebook', 'https://facebook.com/')).toBeNull();
    expect(socialHref('youtube', 'https://youtube.com')).toBeNull();
  });

  it('treats blank as unset', () => {
    expect(socialHref('facebook', '   ')).toBeNull();
    expect(socialHref('instagram', '@')).toBeNull();
  });
});

describe('whatsappHref', () => {
  it('turns a French national number into an international wa.me link', () => {
    expect(whatsappHref('07 56 85 79 64')).toBe('https://wa.me/33756857964');
  });

  it('accepts a + prefix and a 00 prefix', () => {
    expect(whatsappHref('+33 7 56 85 79 64')).toBe('https://wa.me/33756857964');
    expect(whatsappHref('0033756857964')).toBe('https://wa.me/33756857964');
  });

  it('passes a full link straight through', () => {
    expect(whatsappHref('https://wa.me/33756857964')).toBe('https://wa.me/33756857964');
  });

  it('answers null for nothing usable', () => {
    expect(whatsappHref('')).toBeNull();
    expect(whatsappHref('nous appeler')).toBeNull();
  });
});

describe('socialLinks', () => {
  it('drops the ones that are not set and keeps the order', () => {
    expect(
      socialLinks({
        facebook: 'https://facebook.com/',
        instagram: 'talibalim',
        tiktok: '',
        youtube: 'https://youtube.com/@talibalim',
        whatsapp: '07 56 85 79 64',
      }),
    ).toEqual([
      { key: 'instagram', href: 'https://instagram.com/talibalim' },
      { key: 'youtube', href: 'https://youtube.com/@talibalim' },
      { key: 'whatsapp', href: 'https://wa.me/33756857964' },
    ]);
  });
});
