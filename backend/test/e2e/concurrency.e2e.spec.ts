import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, getPrisma } from '../helpers/test-app';

/**
 * THE headline suite: data consistency under concurrent access.
 *
 * The core requirement of the task is that the wallet stays correct when many
 * requests hit it at the same time. These tests prove the system never breaks
 * its invariants under load:
 *
 *   1. No overspend — only as many charges succeed as the balance allows.
 *   2. Never negative — the guard makes overdraft impossible.
 *   3. Balance == history — final balance equals start minus SUM(all events).
 *   4. No lost events — exactly one event row per successful (201) charge.
 *   5. Isolation — concurrent load on different customers never cross-contaminates.
 *
 * These are exactly what a read-modify-write race would violate.
 */
describe('Concurrency & data consistency', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof getPrisma>;

  beforeAll(async () => {
    app = await createTestApp('test-concurrency.db');
    prisma = getPrisma(app);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Sum of cost across a customer's CONSUME ledger rows (amount is negative). */
  async function historyTotal(customerId: string): Promise<number> {
    const agg = await prisma.walletTransaction.aggregate({
      where: { customerId, type: 'CONSUME' },
      _sum: { amount: true },
    });
    return Math.abs(agg._sum.amount ?? 0);
  }

  it('never overspends, never goes negative, and keeps balance == history', async () => {
    const UNIT_PRICE = 5; // cents
    const START_BALANCE = 100; // affords exactly 20 units
    const ATTEMPTS = 60; // fire far more than affordable
    const AFFORDABLE = START_BALANCE / UNIT_PRICE; // 20

    const product = await prisma.product.create({
      data: { name: 'Concurrency Unit', unitPrice: UNIT_PRICE },
    });
    const customer = await prisma.customer.create({
      data: { name: 'Race Subject', walletBalance: START_BALANCE },
    });

    const server = app.getHttpServer();

    const responses = await Promise.all(
      Array.from({ length: ATTEMPTS }).map(() =>
        request(server)
          .post('/api/consumption')
          .send({ customerId: customer.id, productId: product.id, quantity: 1 }),
      ),
    );

    const successes = responses.filter((r) => r.status === 201).length;
    const rejected = responses.filter((r) => r.status === 422).length;

    const finalCustomer = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    const eventCount = await prisma.walletTransaction.count({
      where: { customerId: customer.id, type: 'CONSUME' },
    });
    const spentInHistory = await historyTotal(customer.id);

    // 1. No overspend: exactly the affordable number succeeded, the rest 422.
    expect(successes).toBe(AFFORDABLE);
    expect(rejected).toBe(ATTEMPTS - AFFORDABLE);

    // 2. Never negative + exact math.
    expect(finalCustomer.walletBalance).toBe(START_BALANCE - successes * UNIT_PRICE);
    expect(finalCustomer.walletBalance).toBe(0);
    expect(finalCustomer.walletBalance).toBeGreaterThanOrEqual(0);

    // 3. Balance reconciles with the recorded history (the consistency invariant).
    expect(finalCustomer.walletBalance).toBe(START_BALANCE - spentInHistory);

    // 4. No lost events: one event per successful charge.
    expect(eventCount).toBe(successes);
  });

  it('keeps concurrent credits + consumptions perfectly balanced', async () => {
    const UNIT_PRICE = 10;
    const START_BALANCE = 1000; // affords 100 consumptions
    const product = await prisma.product.create({
      data: { name: 'Mixed Unit', unitPrice: UNIT_PRICE },
    });
    const customer = await prisma.customer.create({
      data: { name: 'Mixed Subject', walletBalance: START_BALANCE },
    });

    const server = app.getHttpServer();
    const CONSUMES = 50;
    const CREDITS = 50;
    const CREDIT_AMOUNT = 20;

    const ops = [
      ...Array.from({ length: CONSUMES }).map(() =>
        request(server)
          .post('/api/consumption')
          .send({ customerId: customer.id, productId: product.id, quantity: 1 }),
      ),
      ...Array.from({ length: CREDITS }).map(() =>
        request(server)
          .post(`/api/customers/${customer.id}/credit`)
          .send({ amountCents: CREDIT_AMOUNT }),
      ),
    ];

    const responses = await Promise.all(ops);
    const okConsumes = responses.filter((r) => r.status === 201).length;
    const okCredits = responses.filter((r) => r.status === 200).length;

    const finalCustomer = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    const spentInHistory = await historyTotal(customer.id);

    const expected = START_BALANCE + okCredits * CREDIT_AMOUNT - okConsumes * UNIT_PRICE;
    expect(finalCustomer.walletBalance).toBe(expected);
    expect(finalCustomer.walletBalance).toBeGreaterThanOrEqual(0);
    // Consumption history still reconciles against the consumed portion.
    expect(spentInHistory).toBe(okConsumes * UNIT_PRICE);
  });

  it('isolates concurrent load across different customers (no cross-contamination)', async () => {
    const UNIT_PRICE = 7;
    const product = await prisma.product.create({
      data: { name: 'Isolation Unit', unitPrice: UNIT_PRICE },
    });
    // Two customers that can afford different amounts.
    const alice = await prisma.customer.create({
      data: { name: 'Alice', walletBalance: 70 }, // affords 10
    });
    const bob = await prisma.customer.create({
      data: { name: 'Bob', walletBalance: 35 }, // affords 5
    });

    const server = app.getHttpServer();

    // Interleave 30 requests for each customer, all fired together.
    const ops = [
      ...Array.from({ length: 30 }).map(() =>
        request(server)
          .post('/api/consumption')
          .send({ customerId: alice.id, productId: product.id, quantity: 1 }),
      ),
      ...Array.from({ length: 30 }).map(() =>
        request(server)
          .post('/api/consumption')
          .send({ customerId: bob.id, productId: product.id, quantity: 1 }),
      ),
    ];
    await Promise.all(ops);

    const aliceFinal = await prisma.customer.findUniqueOrThrow({ where: { id: alice.id } });
    const bobFinal = await prisma.customer.findUniqueOrThrow({ where: { id: bob.id } });

    // Each customer spent down to exactly 0, independently.
    expect(aliceFinal.walletBalance).toBe(0);
    expect(bobFinal.walletBalance).toBe(0);
    expect(await historyTotal(alice.id)).toBe(70);
    expect(await historyTotal(bob.id)).toBe(35);
  });
});
