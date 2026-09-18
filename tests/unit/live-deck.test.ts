import { describe, expect, it } from 'vitest';
import { removeAt } from '@/lib/live/deck';

/** The deck is only ever a list; strings keep the expectations readable. */
const deck = ['a', 'b', 'c', 'd'];

describe('removeAt — where the class lands after a slide is removed', () => {
  it('removing a page before the one on stage shifts the position back with it', () => {
    expect(removeAt(deck, 2, 0)).toEqual({ deck: ['b', 'c', 'd'], current: 1 });
    expect(removeAt(deck, 3, 2)).toEqual({ deck: ['a', 'b', 'd'], current: 2 });
  });

  it('removing the page on stage shows the next page in its place', () => {
    expect(removeAt(deck, 1, 1)).toEqual({ deck: ['a', 'c', 'd'], current: 1 });
  });

  it('removing the last page on stage falls back to the previous one', () => {
    expect(removeAt(deck, 3, 3)).toEqual({ deck: ['a', 'b', 'c'], current: 2 });
  });

  it('removing the last remaining page clears the stage', () => {
    expect(removeAt(['a'], 0, 0)).toEqual({ deck: [], current: -1 });
  });

  it('removing a page after the one on stage moves nothing', () => {
    expect(removeAt(deck, 0, 3)).toEqual({ deck: ['a', 'b', 'c'], current: 0 });
  });

  it('does nothing when no slide is presented', () => {
    expect(removeAt(deck, -1, 2)).toEqual({ deck: ['a', 'b', 'd'], current: -1 });
  });

  it('ignores an index the deck does not have', () => {
    expect(removeAt(deck, 1, -1)).toEqual({ deck, current: 1 });
    expect(removeAt(deck, 1, 9)).toEqual({ deck, current: 1 });
    expect(removeAt([], -1, 0)).toEqual({ deck: [], current: -1 });
  });

  it('never mutates the deck it was given', () => {
    const before = [...deck];
    removeAt(deck, 2, 0);
    expect(deck).toEqual(before);
  });
});
