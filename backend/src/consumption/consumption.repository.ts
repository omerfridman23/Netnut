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
   * Records a consumption event AND atomically deducts its cost from the
   * customer's wallet — safely under heavy concurrent load.
   *
   * How the race-condition is prevented:
   *   Instead of reading the balance and then subtracting, we let the database
   *   do both in one unbreakable step:
   *
   *     UPDATE Customer
   *     SET walletBalance = walletBalance - cost
   *     WHERE id = ? AND walletBalance >= cost
   *
   *   SQLite serializes writers, so two concurrent requests can never both pass
   *   the balance check on a stale value. The number of rows affected tells us
   *   what happened:
   *     1 row → success, decrement applied
   *     0 rows → customer not found, or not enough funds
   *
   *   The event insert happens in the SAME transaction as the deduction, so the
   *   balance and history are always consistent (all-or-nothing).
   *
   * Idempotency:
   *   If an idempotencyKey is supplied and we've seen it before, the original
   *   result is returned immediately — the wallet is NOT touched again.
   *   If two concurrent requests race with the same key, the loser's deduction
   *   is rolled back via DuplicateIdempotencyError, then the winner's event
   *   is replayed.
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
              event = await tx.consumptionEvent.create({
                data: { customerId, productId, quantity, unitPrice, totalCost, idempotencyKey },
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
          // Generous timeouts let queued writers wait instead of failing.
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

  async findHistory(
    customerId: string,
    limit: number,
    offset: number,
  ): Promise<{ rows: EventWithProduct[]; total: number }> {
    const where = { customerId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.consumptionEvent.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
        include: { product: { select: { name: true } } },
      }),
      this.prisma.consumptionEvent.count({ where }),
    ]);
    return { rows, total };
  }

  private async replayIfProcessed(idempotencyKey: string): Promise<ConsumeResult | null> {
    const existing = await this.prisma.consumptionEvent.findUnique({
      where: { idempotencyKey },
      include: { product: { select: { name: true } } },
    });
    if (!existing) return null;

    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: existing.customerId },
      select: { walletBalance: true },
    });
    return { status: 'replayed', event: existing, walletBalance: customer.walletBalance };
  }
}
