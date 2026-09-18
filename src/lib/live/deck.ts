/**
 * Removing one slide from the deck, and where the class lands after it.
 *
 * Pure and separate from the room because the index arithmetic is the part
 * that is easy to get wrong: removing a page before the one on stage must
 * shift the class back with it, removing the page on stage must show the next
 * one rather than a hole, and removing the last page must clear the stage
 * instead of leaving an index pointing at nothing.
 */

export interface DeckAfterRemoval<T> {
  deck: T[];
  /** The index to present after the removal, or -1 when the deck is empty. */
  current: number;
}

export function removeAt<T>(deck: T[], current: number, index: number): DeckAfterRemoval<T> {
  // An index the deck does not have changes nothing: a stale click, or a
  // message that raced a refresh, must not corrupt the position.
  if (index < 0 || index >= deck.length) return { deck, current };

  const next = deck.filter((_, i) => i !== index);

  const after =
    index < current
      ? // Everything before the presented page shifts back by one.
        current - 1
      : index === current
        ? // The page on stage is gone: the next page slides into its place,
          // and if it was the last, the previous one takes the stage. An
          // empty deck lands on -1 through the same expression.
          Math.min(index, next.length - 1)
        : // Nothing after the presented page moves it.
          current;

  return { deck: next, current: after };
}
