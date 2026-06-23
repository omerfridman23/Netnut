import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withRetry } from '../common/errors/retry';
import { env } from '../config/env';
import { ConsumeParams, ConsumeResult, EventWithProduct } from './consumption.types';
import {
  DuplicateIdempotencyError,
  isUniqueKeyViolation,
} from './consumption.repository.helpers';

@Injectable()
export class ConsumptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a CONSUME row in the unified WalletTransaction ledger AND atomically
   * deducts its cost from the customer's wallet — safely under heavy concurrency.
   *
   * Race-condition prevention:
   *   A single conditional UPDATE subtracts the cost only if the balance covers
   *   it (`WHERE id = ? AND walletBalance >= cost`). SQLite serializes writers,
   *   so two concurrent requests can never both pass on a stale balance. Rows
   *   affected: 1 = success, 0 = customer missing or insufficient funds.
   *   The ledger row is inserted in the SAME transaction, so balance and history
   *   are always consistent. The consume row stores a NEGATIVE `amount`.
   *
   * Idempotency:
   *   A repeated request with the same key replays the original result without
   *   charging again; a concurrent duplicate hits the UNIQUE key, rolls back its
   *   decrement, and replays the winner.
   */
  async consume(params: ConsumeParams): Promise<ConsumeResult> {
    const { customerId, productId, quantity, unitPrice, totalCost, idempotencyKey } = params;

    // Fast path: replay without hitting the wallet at all.
    if (idempotencyKey) {
      const replay = await this.replayIfProcessed(idempotencyKey);
      if (replay) return replay;
    }

    try {
      return await withRetry(() =>
        this.prisma.$transaction(
          async (tx): Promise<ConsumeResult> => {
            const affected = await tx.$executeRaw(Prisma.sql`
              UPDATE "Customer"
              SET    "walletBalance" = "walletBalance" - ${totalCost}
              WHERE  "id" = ${customerId}
              AND    "walletBalance" >= ${totalCost}
            `);

            if (affected === 0) {
              const customer = await tx.customer.findUnique({
                where: { id: customerId },
                select: { walletBalance: true },
              });
              if (!customer) return { status: 'customer_not_found' };
              return { status: 'insufficient_funds', available: customer.walletBalance };
            }

            let event: EventWithProduct;
            try {
              event = await tx.walletTransaction.create({
                data: {
                  customerId,
                  type: 'CONSUME',
                  amount: -totalCost, // negative: a debit
                  productId,
                  quantity,
                  unitPrice,
                  idempotencyKey,
                },
                include: { product: { select: { name: true } } },
              });
            } catch (error) {
              if (idempotencyKey && isUniqueKeyViolation(error)) {
                throw new DuplicateIdempotencyError(idempotencyKey);
              }
              throw error;
            }

            const customer = await tx.customer.findUniqueOrThrow({
              where: { id: customerId },
              select: { walletBalance: true },
            });

            return { status: 'ok', event, walletBalance: customer.walletBalance };
          },
          // With connection_limit=1 all transactions serialize on one connection.
          { maxWait: env.txMaxWaitMs, timeout: env.txTimeoutMs },
        ),
      );
    } catch (error) {
      if (error instanceof DuplicateIdempotencyError) {
        const replay = await this.replayIfProcessed(error.key);
        if (replay) return replay;
      }
      throw error;
    }
  }

  /**
   * A customer's CONSUME history, newest first. Filtered by customerId (each
   * customer sees only their own rows) and type, served by the
   * (customerId, createdAt, id) index.
   */
  async findHistory(
    customerId: string,
    limit: number,
    offset: number,
  ): Promise<{ rows: EventWithProduct[]; total: number }> {
    const where = { customerId, type: 'CONSUME' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
        include: { product: { select: { name: true } } },
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);
    return { rows, total };
  }

  private async replayIfProcessed(idempotencyKey: string): Promise<ConsumeResult | null> {
    const existing = await this.prisma.walletTransaction.findUnique({
      where: { idempotencyKey },
      include: { product: { select: { name: true } } },
    });
    // Only replay a CONSUME here; a key reused for a different op type won't match.
    if (!existing || existing.type !== 'CONSUME') return null;

    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: existing.customerId },
      select: { walletBalance: true },
    });
    return { status: 'replayed', event: existing, walletBalance: customer.walletBalance };
  }
}
