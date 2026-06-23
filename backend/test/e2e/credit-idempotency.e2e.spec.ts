import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, getPrisma } from '../helpers/test-app';

/**
 * Proves Stripe-style idempotency on the CREDIT path over HTTP (mirrors the
 * consume idempotency suite):
 *   - the same Idempotency-Key tops up AT MOST once
 *   - the replay returns the unchanged (already-credited) balance
 *   - it holds even when the duplicates arrive concurrently (the race)
 *   - credits without a key still work (and each one credits)
 *
 * This makes credit retries safe under at-least-once delivery (dropped
 * responses, client retries, double-clicked "top up").
 */
describe('Credit idempotency (e2e): a repeated credit tops up at most once', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof getPrisma>;

  beforeAll(async () => {
    app = await createTestApp('test-credit-idempotency.db');
    prisma = getPrisma(app);
  });

  afterAll(async () => {
    await app.close();
  });

  function newCustomer(balance: number) {
    return prisma.customer.create({
      data: { name: 'Credit Idem Subject', walletBalance: balance },
    });
  }

  it('replays a sequential retry without crediting twice', async () => {
    const customer = await newCustomer(1000);
    const server = app.getHttpServer();
    const key = 'credit-retry-sequential';

    const first = await request(server)
      .post(`/api/customers/${customer.id}/credit`)
      .set('Idempotency-Key', key)
      .send({ amountCents: 500 });

    const second = await request(server)
      .post(`/api/customers/${customer.id}/credit`)
      .set('Idempotency-Key', key)
      .send({ amountCents: 500 });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    // Both report the same (credited-once) balance.
    expect(first.body.walletBalance).toBe(1500);
    expect(second.body.walletBalance).toBe(1500);

    const finalCustomer = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    const creditCount = await prisma.creditEvent.count({
      where: { customerId: customer.id },
    });

    // Credited exactly once: one ledger row, balance moved by a single amount.
    expect(finalCustomer.walletBalance).toBe(1500);
    expect(creditCount).toBe(1);
  });

  it('credits once even when the same key arrives concurrently', async () => {
    const customer = await newCustomer(1000);
    const server = app.getHttpServer();
    const key = 'credit-retry-concurrent';
    const DUPLICATES = 25;

    const responses = await Promise.all(
      Array.from({ length: DUPLICATES }).map(() =>
        request(server)
          .post(`/api/customers/${customer.id}/credit`)
          .set('Idempotency-Key', key)
          .send({ amountCents: 500 }),
      ),
    );

    // All requests succeed; despite 25 duplicates, only one real top-up happens.
    const ok = responses.filter((r) => r.status === 200);
    expect(ok.length).toBe(DUPLICATES);

    const finalCustomer = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    const creditCount = await prisma.creditEvent.count({
      where: { customerId: customer.id },
    });

    // Wallet moved exactly once and exactly one credit ledger row exists.
    expect(finalCustomer.walletBalance).toBe(1500);
    expect(creditCount).toBe(1);
  });

  it('treats distinct keys as separate credits', async () => {
    const customer = await newCustomer(1000);
    const server = app.getHttpServer();

    for (let i = 0; i < 3; i++) {
      const res = await request(server)
        .post(`/api/customers/${customer.id}/credit`)
        .set('Idempotency-Key', `credit-distinct-${i}`)
        .send({ amountCents: 100 });
      expect(res.status).toBe(200);
    }

    const finalCustomer = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(finalCustomer.walletBalance).toBe(1000 + 3 * 100);
  });

  it('still credits normally when no key is supplied (each request tops up)', async () => {
    const customer = await newCustomer(1000);
    const server = app.getHttpServer();

    for (let i = 0; i < 3; i++) {
      const res = await request(server)
        .post(`/api/customers/${customer.id}/credit`)
        .send({ amountCents: 100 });
      expect(res.status).toBe(200);
    }

    const finalCustomer = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    const creditCount = await prisma.creditEvent.count({
      where: { customerId: customer.id },
    });

    // No key → no dedup: three separate top-ups, three ledger rows.
    expect(finalCustomer.walletBalance).toBe(1000 + 3 * 100);
    expect(creditCount).toBe(3);
  });
});
