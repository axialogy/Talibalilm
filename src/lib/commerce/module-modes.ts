export type DeliveryMode = 'presentiel' | 'online';

/**
 * How a module is sold, from its published price lines.
 *
 * A module priced at zero is not a purchase: the module page opens it
 * directly, one button, no checkout. A module with any line above zero goes
 * through the ordinary enrolment flow — including its free mode, if it has
 * one, because a module with one free mode and one paid mode is a decision
 * the student has to make with the two prices in front of them.
 *
 * A mode with BOTH a free line and a paid line (two time slots, one offered)
 * lands in both lists; the caller treats any paid mode as "go through the
 * checkout", which is the safe reading of an ambiguous price list.
 */
export function moduleRoutes(entries: { delivery: DeliveryMode; priceCents: number }[]): {
  free: DeliveryMode[];
  paid: DeliveryMode[];
} {
  const free = new Set<DeliveryMode>();
  const paid = new Set<DeliveryMode>();

  for (const entry of entries) {
    if (entry.priceCents > 0) paid.add(entry.delivery);
    else free.add(entry.delivery);
  }

  // Stable order, so two renders of the same catalogue draw the same buttons.
  const order: DeliveryMode[] = ['presentiel', 'online'];
  return {
    free: order.filter((mode) => free.has(mode)),
    paid: order.filter((mode) => paid.has(mode)),
  };
}
