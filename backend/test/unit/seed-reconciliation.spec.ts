import { describe, expect, it } from 'vitest';
import { PRODUCTS, buildSeedPlan, consumedOf } from '../../prisma/seed';

/**
 * The seed must produce demo data that itself satisfies the system invariant
 * (ADR-0002): for every customer, `walletBalance == startingBalance - SUM(history)`.
 *
 * buildSeedPlan is pure (no DB), so we can assert the reconciliation directly on
 * the planned dataset — proving the seeded balances are not arbitrary numbers but
 * reconcile against each customer's seeded consumption history.
 */
describe('Seed reconciliation: walletBalance == startingBalance - SUM(events)', () => {
  const plans = buildSeedPlan(PRODUCTS);

  it('reconciles every seeded customer and never goes negative', () => {
    for (const plan of plans) {
      const consumed = consumedOf(PRODUCTS, plan.events);
      expect(plan.walletBalance).toBe(plan.startingBalance - consumed);
      expect(plan.walletBalance).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(plan.walletBalance)).toBe(true);
    }
  });

  it('keeps the required demonstrative scenarios after subtracting events', () => {
    const byName = (needle: string) =>
      plans.find((p) => p.name.toLowerCase().includes(needle));

    // Empty wallet ends at exactly 0 — drained by its own history.
    const empty = byName('empty wallet');
    expect(empty).toBeDefined();
    expect(empty!.events.length).toBeGreaterThan(0);
    expect(empty!.walletBalance).toBe(0);

    // Near-zero stays low (and positive) after its event.
    const low = byName('near-zero');
    expect(low).toBeDefined();
    expect(low!.events.length).toBeGreaterThan(0);
    expect(low!.walletBalance).toBeGreaterThan(0);
    expect(low!.walletBalance).toBeLessThan(1000); // still a low-balance warning

    // Heavy consumer keeps a large balance despite lots of history.
    const heavy = byName('heavy consumer');
    expect(heavy).toBeDefined();
    expect(heavy!.events.length).toBe(250);
    expect(heavy!.walletBalance).toBeGreaterThan(100_00);

    // No-history customer: balance equals its starting balance exactly.
    const newcomer = byName('no history');
    expect(newcomer).toBeDefined();
    expect(newcomer!.events.length).toBe(0);
    expect(newcomer!.walletBalance).toBe(newcomer!.startingBalance);

    // Recently credited keeps a healthy balance.
    const credited = byName('recently credited');
    expect(credited).toBeDefined();
    expect(credited!.walletBalance).toBeGreaterThan(100_00);
  });
});
