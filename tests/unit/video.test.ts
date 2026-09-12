import { describe, expect, it } from 'vitest';
import { embedUrl, parseVideoRef } from '@/lib/content/video';

/**
 * The office pastes links; the database stores ids. These prove the translation
 * both ways, and — more importantly — that nothing pasted can escape into the
 * iframe src as a different host or a script URL.
 */
describe('parseVideoRef', () => {
  it('reads every shape of YouTube link the office might paste', () => {
    const id = 'dQw4w9WgXcQ';
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtube.com/watch?v=${id}&t=42s`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`,
      `https://youtu.be/${id}?t=10`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/live/${id}`,
      `https://www.youtube.com/shorts/${id}`,
    ]) {
      expect(parseVideoRef(url), url).toEqual({ provider: 'youtube', id });
    }
  });

  it('reads a Google Drive share link', () => {
    const id = '1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUv';
    expect(parseVideoRef(`https://drive.google.com/file/d/${id}/view?usp=sharing`)).toEqual({
      provider: 'drive',
      id,
    });
    expect(parseVideoRef(`https://drive.google.com/open?id=${id}`)).toEqual({
      provider: 'drive',
      id,
    });
  });

  it('accepts a bare YouTube id, because that is what used to be stored', () => {
    expect(parseVideoRef('dQw4w9WgXcQ')).toEqual({ provider: 'youtube', id: 'dQw4w9WgXcQ' });
  });

  it('never stores a URL — the database constraint would reject it anyway', () => {
    const parsed = parseVideoRef('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(parsed.id).not.toMatch(/^https?:/);
    expect(parsed.id).not.toContain('/');
  });

  it('refuses a link it does not recognise rather than guessing', () => {
    for (const bad of [
      '',
      '   ',
      'https://example.com/watch?v=dQw4w9WgXcQ',
      'https://evil.com/drive.google.com/file/d/abc',
      'not a link at all',
      'https://youtube.com/watch?v=short',
    ]) {
      expect(parseVideoRef(bad), bad).toEqual({ provider: 'none', id: '' });
    }
  });

  it('cannot be talked into a script URL or another host', () => {
    for (const attack of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
      '//evil.com/x',
    ]) {
      const ref = parseVideoRef(attack);
      expect(ref.provider, attack).toBe('none');
      expect(embedUrl(ref), attack).toBeNull();
    }
  });
});

describe('embedUrl', () => {
  it('builds a cookie-free YouTube embed from a fixed template', () => {
    const url = embedUrl({ provider: 'youtube', id: 'dQw4w9WgXcQ' });
    expect(url).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1');
  });

  it('builds a Drive preview embed', () => {
    const id = '1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUv';
    expect(embedUrl({ provider: 'drive', id })).toBe(
      `https://drive.google.com/file/d/${id}/preview`,
    );
  });

  it('returns null for a provider with no embed, or a malformed id', () => {
    expect(embedUrl({ provider: 'none', id: '' })).toBeNull();
    expect(embedUrl({ provider: 'bunny', id: 'abc' })).toBeNull();
    // An id that somehow bypassed the parser still cannot reach the iframe.
    expect(embedUrl({ provider: 'youtube', id: '"><script>' })).toBeNull();
    expect(embedUrl({ provider: 'drive', id: '../../etc/passwd' })).toBeNull();
  });
});
