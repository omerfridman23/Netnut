import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import fc from 'fast-check';
import { createTestApp, getPrisma } from '../helpers/test-app';

/**
 * Property-based ("fuzz") test for wallet consistency under concurrency.
 *
 * Example-based tests check a few hand-picked scenarios. This instead generates
 * MANY random mixes of credits and consumptions, fires each mix concurrently,
 * and asserts the core invariant holds for EVERY generated case:
 *
 *   1. finalBalance == startBalance + SUM(successful credits) - SUM(successful consumes)
 *   2. finalBalance >= 0                      (never overdraft)
 *   3. recorded events == number of successful consumes   (no lost/extra events)
 *   4. SUM(event.totalCost) == consumed total            (history reconciles)
 *
 * Because the operations run concurrently, *which* consumes succeed is not
 * predictable — so we derive the expectation from the actual HTTP responses and
 * assert the wallet reconciles against them. If a read-modify-write race existed,
 * fast-check would shrink to a tiny failing sequence and print it.
 *
 * Each fast-check "run" is a full randomized workload: a fresh wallet plus an
 * array of 1..20 credit/consume operations fired CONCURRENTLY, so every run
 * fans out into many real concurrent interleavings against the live SQLite DB.
 * The number of runs is controlled by PROPERTY_NUM_RUNS (default 300 — hundreds
 * of workloads locally, kept fast because the app boots one Nest instance on a
 * single SQLite connection so runs are effectively serialized). CI sets it to
 * 1000 so the suite genuinely executes a thousand random workloads per build.
 */
const NUM_RUNS = (() => {
  const parsed = Number.parseInt(process.env.PROPERTY_NUM_RUNS ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
})();

// Give the property test ample headroom: at ~1000 runs the body alone takes
// well under a minute, but we raise the per-test timeout so a high
// PROPERTY_NUM_RUNS (CI uses 1000) can never trip vitest's 60s default.
const PROPERTY_TEST_TIMEOUT_MS = 300_000;
describe('Property: wallet stays consistent for any random concurrent workload', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof getPrisma>;
  let productId: string;

  const UNIT_PRICE = 5;

  beforeAll(async () => {
    app = await createTestApp('test-property.db');
    prisma = getPrisma(app);
    const product = await prisma.product.create({
      data: { name: 'Property Unit', unitPrice: UNIT_PRICE },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await app.close();
  });

  type Op = { kind: 'credit'; amount: number } | { kind: 'consume'; qty: number };

  const opArb: fc.Arbitrary<Op> = fc.oneof(
    fc.record({ kind: fc.constant('credit' as const), amount: fc.integer({ min: 1, max: 100 }) }),
    fc.record({ kind: fc.constant('consume' as const), qty: fc.integer({ min: 1, max: 5 }) }),
  );

  it(
    `reconciles balance with recorded operations across ${NUM_RUNS} random concurrent workloads (each fanning out into many interleavings)`,
    async () => {
    const server = app.getHttpServer();

    await fc.assert(
      fc.asyncProperty(
        fc.array(opArb, { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 400 }),
        async (ops, startBalance) => {
          // Fresh wallet per generated case so runs never interfere.
          const customer = await prisma.customer.create({
            data: { name: 'Fuzz Wallet', walletBalance: startBalance },
          });

          // Fire the whole random workload concurrently.
          const responses = await Promise.all(
            ops.map((op) =>
              op.kind === 'credit'
                ? request(server)
                    .post(`/api/customers/${customer.id}/credit`)
                    .send({ amountCents: op.amount })
                : request(server)
                    .post('/api/consumption')
                    .send({ customerId: customer.id, productId, quantity: op.qty }),
            ),
          );

          // Derive what actually succeeded from the responses.
          let creditedTotal = 0;
          let consumedTotal = 0;
          let consumeSuccesses = 0;
          responses.forEach((res, i) => {
            const op = ops[i];
            if (op.kind === 'credit' && res.status === 200) {
              creditedTotal += op.amount;
            } else if (op.kind === 'consume' && res.status === 201) {
              consumedTotal += op.qty * UNIT_PRICE;
              consumeSuccesses += 1;
            }
          });

          const finalBalance = (
            await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })
          ).walletBalance;
          const agg = await prisma.consumptionEvent.aggregate({
            where: { customerId: customer.id },
            _sum: { totalCost: true },
            _count: true,
          });

          // 1. Balance reconciles exactly with the operations that succeeded.
          expect(finalBalance).toBe(startBalance + creditedTotal - consumedTotal);
          // 2. Never negative.
          expect(finalBalance).toBeGreaterThanOrEqual(0);
          // 3. One event per successful consume — no lost or phantom events.
          expect(agg._count).toBe(consumeSuccesses);
          // 4. Recorded history reconciles with the consumed amount.
          expect(agg._sum.totalCost ?? 0).toBe(consumedTotal);
        },
      ),
      { numRuns: NUM_RUNS },
    );
    },
    PROPERTY_TEST_TIMEOUT_MS,
  );
});
