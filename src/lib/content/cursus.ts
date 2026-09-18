/**
 * Which cursus/year/mode combinations a course belongs to.
 *
 * This lives outside the component on purpose. `CourseCursus` is a
 * `'use client'` module, and a function exported from one is a client
 * reference when a server component imports it: the admin course page builds
 * this set during its server render, so keeping the helper there made every
 * visit throw "Attempted to call membershipKey() from the server". A pure
 * string join belongs in neither the client nor the server half — it belongs
 * here, where both can call it.
 */

/** The `cursusId|year|delivery` keys a course is included in. */
export type Membership = Set<string>;

export function membershipKey(cursusId: string, year: number, delivery: string): string {
  return `${cursusId}|${year}|${delivery}`;
}
