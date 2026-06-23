import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, getPrisma } from '../helpers/test-app';

/**
 * Proves real (Stripe-style) idempotency on the consume path over HTTP:
 *   - the same Idempotency-Key always charges AT MOST once
 *   - the replay returns the original event + the unchanged balance
 *   - it holds even when the duplicates arrive concurrently (the race)
 *   - distinct keys are unaffected (each charges normally)
 *
 * This is what makes retries safe under at-least-once delivery (dropped
 * responses, client retries, queue redelivery).
 */
describe('Idempotency (e2e): a repeated request charges at most once', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof getPrisma>;

  beforeAll(async () => {
    app = await createTestApp('test-idempotency.db');
    prisma = getPrisma(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function seed(unitPrice: number, balance: number) {
    const product = await prisma.product.create({
      data: { name: 'Idem Unit', unitPrice },
    });
    const customer = await prisma.customer.create({
      data: { name: 'Idem Subject', walletBalance: balance },
    });
    return { product, customer };
  }

  it('replays a sequential retry without charging twice', async () => {
    const { product, customer } = await seed(100, 1000);
    const server = app.getHttpServer();
    const key = 'retry-key-sequential';

    const first = await request(server)
      .post('/api/consumption')
      .set('Idempotency-Key', key)
      .send({ customerId: customer.id, productId: product.id, quantity: 1 });

    const second = await request(server)
      .post('/api/consumption')
      .set('Idempotency-Key', key)
      .send({ customerId: customer.id, productId: product.id, quantity: 1 });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    // First is a fresh charge, second is a replay of the same event.
    expect(first.body.replayed).toBe(false);
    expect(second.body.replayed).toBe(true);
    expect(second.body.event.id).toBe(first.body.event.id);

    const finalCustomer = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    const eventCount = await prisma.consumptionEvent.count({
      where: { customerId: customer.id },
    });

    // Charged exactly once: balance moved by a single unit price, one event.
    expect(finalCustomer.walletBalance).toBe(1000 - 100);
    expect(eventCount).toBe(1);
  });

  it('charges once even when the same key arrives concurrently', async () => {
    const { product, customer } = await seed(100, 1000);
    const server = app.getHttpServer();
    const key = 'retry-key-concurrent';
    const DUPLICATES = 25;

    const responses = await Promise.all(
      Array.from({ length: DUPLICATES }).map(() =>
        request(server)
          .post('/api/consumption')
          .set('Idempotency-Key', key)
          .send({ customerId: customer.id, productId: product.id, quantity: 1 }),
      ),
    );

    // All requests succeed (none error); exactly one is the real charge.
    const ok = responses.filter((r) => r.status === 201);
    expect(ok.length).toBe(DUPLICATES);
    const freshCharges = ok.filter((r) => r.body.replayed === false).length;
    expect(freshCharges).toBe(1);

    const finalCustomer = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    const eventCount = await prisma.consumptionEvent.count({
      where: { customerId: customer.id },
    });

    // Despite 25 concurrent duplicates, the wallet moved once and one event exists.
    expect(finalCustomer.walletBalance).toBe(1000 - 100);
    expect(eventCount).toBe(1);
  });

  it('treats distinct keys as separate charges', async () => {
    const { product, customer } = await seed(100, 1000);
    const server = app.getHttpServer();

    for (let i = 0; i < 3; i++) {
      const res = await request(server)
        .post('/api/consumption')
        .set('Idempotency-Key', `distinct-${i}`)
        .send({ customerId: customer.id, productId: product.id, quantity: 1 });
      expect(res.status).toBe(201);
      expect(res.body.replayed).toBe(false);
    }

    const finalCustomer = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(finalCustomer.walletBalance).toBe(1000 - 3 * 100);
  });
});
