import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, getPrisma } from '../helpers/test-app';

/**
 * The "show the bug, then show the fix" demo.
 *
 * Two implementations race the SAME workload (many concurrent deductions on one
 * wallet):
 *
 *   NAIVE  — read the balance into the app, subtract in JS, write it back.
 *            This is the classic read-modify-write: concurrent requests read the
 *            same stale balance and overwrite each other → LOST UPDATES. The
 *            business under-charges (money silently lost), and without a guard a
 *            balance could even go negative.
 *
 *   CORRECT — the real /api/consumption path: a single atomic guarded UPDATE
 *            (`... WHERE walletBalance >= cost`) inside a transaction. No
 *            read-modify-write window exists, so every concurrent request is
 *            accounted for exactly once.
 *
 * The test proves the correct path is exact, and that the naive path is provably
 * wrong on the same input — which is *why* the atomic design matters.
 */
describe('Race demo: naive read-modify-write vs atomic guarded UPDATE', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof getPrisma>;

  const UNIT_PRICE = 5;
  const START_BALANCE = 500;
  const ATTEMPTS = 100; // far more concurrency than the wallet can serialize naively

  beforeAll(async () => {
    app = await createTestApp('test-race-demo.db');
    prisma = getPrisma(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('demonstrates lost updates in the naive path and exactness in the atomic path', async () => {
    const product = await prisma.product.create({
      data: { name: 'Race Demo Unit', unitPrice: UNIT_PRICE },
    });

    // --- NAIVE path: read-modify-write, fired concurrently -------------------
    const naiveCustomer = await prisma.customer.create({
      data: { name: 'Naive Wallet', walletBalance: START_BALANCE },
    });

    let naiveApplied = 0;
    await Promise.all(
      Array.from({ length: ATTEMPTS }).map(async () => {
        // The bug: read, decide, then write an ABSOLUTE value computed in JS.
        const current = await prisma.customer.findUniqueOrThrow({
          where: { id: naiveCustomer.id },
          select: { walletBalance: true },
        });
        if (current.walletBalance >= UNIT_PRICE) {
          await prisma.customer.update({
            where: { id: naiveCustomer.id },
            data: { walletBalance: current.walletBalance - UNIT_PRICE },
          });
          naiveApplied += 1;
        }
      }),
    );

    const naiveFinal = (
      await prisma.customer.findUniqueOrThrow({ where: { id: naiveCustomer.id } })
    ).walletBalance;
    // What the balance SHOULD be if every applied deduction had been counted.
    const naiveExpectedIfCorrect = START_BALANCE - naiveApplied * UNIT_PRICE;

    // --- CORRECT path: the real atomic endpoint, same concurrency ------------
    const correctCustomer = await prisma.customer.create({
      data: { name: 'Atomic Wallet', walletBalance: START_BALANCE },
    });
    const server = app.getHttpServer();

    const responses = await Promise.all(
      Array.from({ length: ATTEMPTS }).map(() =>
        request(server)
          .post('/api/consumption')
          .send({ customerId: correctCustomer.id, productId: product.id, quantity: 1 }),
      ),
    );
    const correctOk = responses.filter((r) => r.status === 201).length;
    const correctFinal = (
      await prisma.customer.findUniqueOrThrow({ where: { id: correctCustomer.id } })
    ).walletBalance;
    const correctEvents = await prisma.walletTransaction.count({
      where: { customerId: correctCustomer.id, type: 'CONSUME' },
    });

    // --- Report --------------------------------------------------------------
    /* eslint-disable no-console */
    console.log('\n=== RACE DEMO: naive read-modify-write vs atomic UPDATE ===');
    console.log(`Workload: ${ATTEMPTS} concurrent deductions of ${UNIT_PRICE}c on a ${START_BALANCE}c wallet\n`);
    console.log('NAIVE  (read-modify-write):');
    console.log(`  deductions the app thought it applied : ${naiveApplied}`);
    console.log(`  balance if those were all counted     : ${naiveExpectedIfCorrect}c`);
    console.log(`  ACTUAL final balance                  : ${naiveFinal}c`);
    console.log(`  lost updates (money silently kept)    : ${naiveFinal - naiveExpectedIfCorrect}c  <-- BUG`);
    console.log('\nCORRECT (atomic guarded UPDATE):');
    console.log(`  successful charges (201)              : ${correctOk}`);
    console.log(`  events recorded                       : ${correctEvents}`);
    console.log(`  final balance                         : ${correctFinal}c`);
    console.log(`  expected (start - ok*price)           : ${START_BALANCE - correctOk * UNIT_PRICE}c`);
    console.log('===========================================================\n');
    /* eslint-enable no-console */

    // --- Assertions ----------------------------------------------------------
    // CORRECT path is exact and consistent under concurrency.
    expect(correctFinal).toBe(START_BALANCE - correctOk * UNIT_PRICE);
    expect(correctFinal).toBeGreaterThanOrEqual(0);
    expect(correctEvents).toBe(correctOk);

    // NAIVE path lost updates: the real balance is higher than the deductions it
    // believed it applied (classic read-modify-write data loss).
    expect(naiveFinal).toBeGreaterThan(naiveExpectedIfCorrect);
  });
});
