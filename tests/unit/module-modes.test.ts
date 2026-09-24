import { describe, expect, it } from 'vitest';
import { moduleRoutes } from '../../src/lib/commerce/module-modes';

/**
 * A module not attached to any cursus could not be bought at all: the
 * "Acheter ce module" card posted the id of a cursus row that a project
 * without the seed migration does not have, and the click was dropped in
 * silence. The route a module takes now depends only on its own prices, and
 * this is the decision that says which one.
 */
describe('how a module is sold', () => {
  it('treats a module with no published price as not on sale', () => {
    expect(moduleRoutes([])).toEqual({ free: [], paid: [] });
  });

  it('opens a module whose only price is zero', () => {
    expect(moduleRoutes([{ delivery: 'online', priceCents: 0 }])).toEqual({
      free: ['online'],
      paid: [],
    });
  });

  it('opens a module that is free in both modes, with both buttons', () => {
    expect(
      moduleRoutes([
        { delivery: 'online', priceCents: 0 },
        { delivery: 'presentiel', priceCents: 0 },
      ]),
    ).toEqual({ free: ['presentiel', 'online'], paid: [] });
  });

  it('sends a priced module through the checkout, even when one mode is free', () => {
    // The student must see both prices before choosing; a direct-access button
    // next to a paid mode would hide the one that costs money.
    expect(
      moduleRoutes([
        { delivery: 'online', priceCents: 0 },
        { delivery: 'presentiel', priceCents: 30000 },
      ]),
    ).toEqual({ free: ['online'], paid: ['presentiel'] });
  });

  it('reads two time slots for one mode as paid when either one is', () => {
    expect(
      moduleRoutes([
        { delivery: 'online', priceCents: 0 },
        { delivery: 'online', priceCents: 30000 },
      ]),
    ).toEqual({ free: ['online'], paid: ['online'] });
  });

  it('keeps the mode order stable whatever order the catalogue returns', () => {
    const routes = moduleRoutes([
      { delivery: 'online', priceCents: 30000 },
      { delivery: 'presentiel', priceCents: 30000 },
    ]);
    expect(routes.paid).toEqual(['presentiel', 'online']);
  });
});
