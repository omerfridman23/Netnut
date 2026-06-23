import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, getPrisma } from '../helpers/test-app';
import { ConsumptionService } from '../../src/consumption/consumption.service';
import {
  InsufficientFundsException,
  ResourceNotFoundException,
} from '../../src/common/errors/app.errors';

/**
 * Integration tests: exercise the real ConsumptionService + repository against a
 * real SQLite database, but WITHOUT going through HTTP. This pins the business
 * rules (money math, price snapshot, error cases, idempotency replay) close to
 * the source, so a failure here points straight at the domain logic.
 */
describe('ConsumptionService (integration)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof getPrisma>;
  let service: ConsumptionService;

  beforeAll(async () => {
    app = await createTestApp('test-consumption-int.db');
    prisma = getPrisma(app);
    service = app.get(ConsumptionService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function fixture(unitPrice: number, balance: number) {
    const product = await prisma.product.create({
      data: { name: 'Int Product', unitPrice },
    });
    const customer = await prisma.customer.create({
      data: { name: 'Int Customer', walletBalance: balance },
    });
    return { product, customer };
  }

  it('charges the wallet and snapshots the unit price', async () => {
    const { product, customer } = await fixture(250, 1000);

    const result = await service.consume({
      customerId: customer.id,
      productId: product.id,
      quantity: 2,
    });

    expect(result.replayed).toBe(false);
    expect(result.event.unitPrice).toBe(250);
    expect(result.event.totalCost).toBe(500);
    expect(result.walletBalance).toBe(500);

    const persisted = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(persisted.walletBalance).toBe(500);
  });

  it('rejects insufficient funds and leaves the wallet untouched', async () => {
    const { product, customer } = await fixture(250, 100); // can't afford one unit

    await expect(
      service.consume({ customerId: customer.id, productId: product.id, quantity: 1 }),
    ).rejects.toBeInstanceOf(InsufficientFundsException);

    const persisted = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(persisted.walletBalance).toBe(100); // unchanged
    const events = await prisma.walletTransaction.count({
      where: { customerId: customer.id, type: 'CONSUME' },
    });
    expect(events).toBe(0); // no orphan event
  });

  it('throws when the product does not exist', async () => {
    const { customer } = await fixture(250, 1000);
    await expect(
      service.consume({ customerId: customer.id, productId: 'missing', quantity: 1 }),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it('throws when the customer does not exist', async () => {
    const { product } = await fixture(250, 1000);
    await expect(
      service.consume({ customerId: 'missing', productId: product.id, quantity: 1 }),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it('replays an identical request (same idempotency key) without charging twice', async () => {
    const { product, customer } = await fixture(250, 1000);
    const key = 'int-replay-key';

    const first = await service.consume(
      { customerId: customer.id, productId: product.id, quantity: 1 },
      key,
    );
    const second = await service.consume(
      { customerId: customer.id, productId: product.id, quantity: 1 },
      key,
    );

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.event.id).toBe(first.event.id);

    const persisted = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(persisted.walletBalance).toBe(750); // charged exactly once
    const events = await prisma.walletTransaction.count({
      where: { customerId: customer.id, type: 'CONSUME' },
    });
    expect(events).toBe(1);
  });
});
