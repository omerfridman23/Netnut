/**
 * Seed script.
 *
 * Creates ~10 products and ~10 customers that deliberately cover the edge-case
 * scenarios the dashboard needs to demonstrate:
 *   - a heavy consumer (lots of history)
 *   - a near-zero balance customer (low-balance warning)
 *   - a zero balance customer (empty-wallet indicator)
 *   - a recently credited customer
 *   - a customer with no consumption history at all (empty-state UI)
 *
 * Consistency:
 *   Seeded balances are NOT arbitrary numbers. Each customer is given an explicit
 *   `startingBalance`, and the stored `walletBalance` is computed as
 *   `startingBalance - SUM(that customer's consumption events)`. This means every
 *   seeded customer satisfies the same invariant the runtime guarantees
 *   (ADR-0002): `walletBalance == startingBalance - SUM(history)`. So the demo
 *   data itself reconciles and the "provably consistent" claim holds from row one.
 *
 * It is idempotent-ish: it wipes the three tables first so re-running produces a
 * clean, predictable dataset. Safe because seeding only runs against dev/demo DBs.
 */
import { Prisma, PrismaClient, Product } from '@prisma/client';

// All amounts are in CENTS.
export const PRODUCTS = [
  { name: 'API Calls (per 1k)', unitPrice: 5 },
  { name: 'Bandwidth GB', unitPrice: 12 },
  { name: 'Storage GB / month', unitPrice: 8 },
  { name: 'Proxy Port', unitPrice: 150 },
  { name: 'Residential IP Hour', unitPrice: 25 },
  { name: 'Datacenter IP Hour', unitPrice: 10 },
  { name: 'Concurrent Session', unitPrice: 40 },
  { name: 'Premium Support Minute', unitPrice: 200 },
  { name: 'Web Unblocker Request', unitPrice: 3 },
  { name: 'SERP Query', unitPrice: 7 },
];

/** A single planned consumption event, referencing a product by its index. */
export interface SeedEventSpec {
  productIdx: number;
  quantity: number;
  /** Optional explicit timestamp (used to spread the heavy consumer's history). */
  createdAt?: Date;
}

/** A planned customer with an explicit starting balance and its history. */
export interface SeedCustomerPlan {
  name: string;
  /** Explicit starting balance in cents, before any consumption. */
  startingBalance: number;
  /** Stored balance = startingBalance - SUM(events). Always reconciles. */
  walletBalance: number;
  events: SeedEventSpec[];
}

/** Sum of totalCost (unitPrice * quantity) across a set of planned events. */
export function consumedOf(
  products: { unitPrice: number }[],
  events: SeedEventSpec[],
): number {
  return events.reduce(
    (sum, e) => sum + products[e.productIdx].unitPrice * e.quantity,
    0,
  );
}

/**
 * Builds the full seed plan (pure — no database access), computing each
 * customer's stored balance as `startingBalance - SUM(events)`. Keeping this
 * pure makes the seed reconciliation invariant unit-testable.
 */
export function buildSeedPlan(
  products: { unitPrice: number }[],
): SeedCustomerPlan[] {
  // Helper: finalize a plan by computing the reconciled walletBalance.
  const plan = (
    name: string,
    startingBalance: number,
    events: SeedEventSpec[],
  ): SeedCustomerPlan => ({
    name,
    startingBalance,
    events,
    walletBalance: startingBalance - consumedOf(products, events),
  });

  // Heavy consumer: 250 events spread over the past ~10 days.
  const now = Date.now();
  const heavyEvents: SeedEventSpec[] = [];
  for (let i = 0; i < 250; i++) {
    heavyEvents.push({
      productIdx: i % products.length,
      quantity: 1 + (i % 5),
      createdAt: new Date(now - i * 1000 * 60 * 57), // ~ every 57 min back in time
    });
  }

  return [
    // 1. Heavy consumer: large balance + lots of history. Starts well-funded and
    //    keeps a large balance even after a long consumption history.
    plan('Heavy Corp (heavy consumer)', 6_000_00, heavyEvents),

    // 2. Near-zero balance (low-balance warning). Starts at 126, consumes 6,
    //    ends at exactly 120 cents.
    plan('Thrifty Ltd (near-zero balance)', 126, [{ productIdx: 8, quantity: 2 }]),

    // 3. Empty wallet (empty-wallet indicator). Starts at 60, consumes 60,
    //    ends at exactly 0 — drained by its own history, still reconciles.
    plan('Broke Inc (empty wallet)', 60, [{ productIdx: 5, quantity: 6 }]),

    // 4. Recently credited (healthy balance after a single small charge).
    plan('Freshly Funded LLC (recently credited)', 1_000_00, [
      { productIdx: 4, quantity: 4 },
    ]),

    // 5. No consumption history (empty-state UI): balance == startingBalance.
    plan('Newcomer Co (no history)', 250_00, []),

    // A handful of ordinary customers with varied balances and light histories.
    plan('Acme Systems', 75_00, [
      { productIdx: 0, quantity: 10 },
      { productIdx: 1, quantity: 3 },
    ]),
    plan('Globex', 4_25, []),
    plan('Initech', 320_00, [{ productIdx: 3, quantity: 1 }]),
    plan('Umbrella Data', 9_90, []),
    plan('Soylent Cloud', 600_00, []),
  ];
}

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('Seeding database...');

    // Clean slate (respect FK order: events first).
    await prisma.creditEvent.deleteMany();
    await prisma.consumptionEvent.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.product.deleteMany();

    const products: Product[] = [];
    for (const p of PRODUCTS) {
      products.push(await prisma.product.create({ data: p }));
    }
    console.log(`Created ${products.length} products.`);

    const customerPlans = buildSeedPlan(products);
    for (const c of customerPlans) {
      const customer = await prisma.customer.create({
        data: { name: c.name, walletBalance: c.walletBalance },
      });

      if (c.events.length > 0) {
        const events: Prisma.ConsumptionEventCreateManyInput[] = c.events.map(
          (e) => {
            const prod = products[e.productIdx];
            return {
              customerId: customer.id,
              productId: prod.id,
              quantity: e.quantity,
              unitPrice: prod.unitPrice,
              totalCost: prod.unitPrice * e.quantity,
              createdAt: e.createdAt,
            };
          },
        );
        await prisma.consumptionEvent.createMany({ data: events });
      }
    }

    console.log(`Created ${customerPlans.length} customers.`);
    console.log('Seeding complete.');
  } finally {
    await prisma.$disconnect();
  }
}

// Only auto-run when invoked as the seed script (ts-node prisma/seed.ts), not
// when imported by tests that exercise buildSeedPlan() in isolation.
if (process.env.VITEST === undefined) {
  main().catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  });
}
