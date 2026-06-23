import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, getPrisma } from '../helpers/test-app';
import { CustomersService } from '../../src/customers/customers.service';
import { ResourceNotFoundException } from '../../src/common/errors/app.errors';

/**
 * Integration tests for crediting wallets via the real CustomersService +
 * repository against a real SQLite database (no HTTP).
 */
describe('CustomersService (integration)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof getPrisma>;
  let service: CustomersService;

  beforeAll(async () => {
    app = await createTestApp('test-customers-int.db');
    prisma = getPrisma(app);
    service = app.get(CustomersService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('credits a wallet by an exact integer amount', async () => {
    const customer = await prisma.customer.create({
      data: { name: 'Credit Me', walletBalance: 100 },
    });

    const updated = await service.creditWallet(customer.id, 5000);
    expect(updated.walletBalance).toBe(5100);

    const persisted = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(persisted.walletBalance).toBe(5100);
  });

  it('credits idempotently: same key tops up at most once and records one CREDIT row', async () => {
    const customer = await prisma.customer.create({
      data: { name: 'Idem Credit', walletBalance: 0 },
    });
    const key = 'credit-key-int-1';

    const first = await service.creditWallet(customer.id, 2500, key);
    const second = await service.creditWallet(customer.id, 2500, key); // retry, same key

    expect(first.walletBalance).toBe(2500);
    expect(second.walletBalance).toBe(2500); // replayed — NOT 5000

    const persisted = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(persisted.walletBalance).toBe(2500);

    // Exactly one CREDIT row in the unified ledger.
    const creditRows = await prisma.walletTransaction.count({
      where: { customerId: customer.id, type: 'CREDIT' },
    });
    expect(creditRows).toBe(1);
  });

  it('throws when crediting a non-existent customer', async () => {
    await expect(service.creditWallet('missing', 1000)).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });

  it('reads a customer or throws a typed not-found error', async () => {
    const customer = await prisma.customer.create({
      data: { name: 'Readable', walletBalance: 42 },
    });

    const dto = await service.findByIdOrThrow(customer.id);
    expect(dto.id).toBe(customer.id);
    expect(dto.walletBalance).toBe(42);

    await expect(service.findByIdOrThrow('missing')).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});
