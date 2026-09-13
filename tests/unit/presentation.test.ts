import { describe, expect, it } from 'vitest';
import {
  formatBullets,
  formatHighlights,
  parseBullets,
  parseHighlights,
  readBullets,
  readGallery,
  readHighlights,
} from '@/lib/content/presentation';

describe('parseBullets', () => {
  it('keeps one entry per line and drops the blanks', () => {
    expect(parseBullets('Niveau 1\n\n  Lire l’arabe  \n')).toEqual(['Niveau 1', 'Lire l’arabe']);
  });

  it('strips a bullet character the typist added themselves', () => {
    expect(parseBullets('- Niveau 1\n• Niveau 2\n— Niveau 3')).toEqual([
      'Niveau 1',
      'Niveau 2',
      'Niveau 3',
    ]);
  });

  it('round-trips through the textarea format', () => {
    const items = ['Niveau 1', 'Niveau 2'];
    expect(parseBullets(formatBullets(items))).toEqual(items);
  });

  it('answers with an empty list for an empty box', () => {
    expect(parseBullets('   \n \n')).toEqual([]);
  });
});

describe('parseHighlights', () => {
  it('splits a title from its body on the first pipe only', () => {
    expect(parseHighlights('Encadrement | Des enseignants | diplômés')).toEqual([
      { title: 'Encadrement', body: 'Des enseignants | diplômés' },
    ]);
  });

  it('treats a line with no separator as a title alone', () => {
    expect(parseHighlights('Encadrement')).toEqual([{ title: 'Encadrement', body: '' }]);
  });

  it('round-trips', () => {
    const items = [
      { title: 'Encadrement', body: 'Des enseignants diplômés' },
      { title: 'Rythme', body: '' },
    ];
    expect(parseHighlights(formatHighlights(items))).toEqual(items);
  });
});

describe('reading back what the column holds', () => {
  it('ignores anything that is not an array', () => {
    expect(readBullets({ a: 1 })).toEqual([]);
    expect(readHighlights('nope')).toEqual([]);
    expect(readGallery(null)).toEqual([]);
  });

  it('drops entries with no title or no url rather than rendering blanks', () => {
    expect(readHighlights([{ title: '', body: 'x' }, { title: 'ok' }])).toEqual([
      { title: 'ok', body: '' },
    ]);
    expect(readGallery([{ url: 'javascript:alert(1)' }, { url: '/a.png' }])).toEqual([
      { url: '/a.png', alt: '' },
    ]);
  });

  it('accepts the plain-string shape an older row may hold', () => {
    expect(readHighlights(['Encadrement'])).toEqual([{ title: 'Encadrement', body: '' }]);
    expect(readGallery(['https://cdn.example/1.png'])).toEqual([
      { url: 'https://cdn.example/1.png', alt: '' },
    ]);
  });
});
