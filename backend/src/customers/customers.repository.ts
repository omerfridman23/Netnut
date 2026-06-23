import { Injectable } from '@nestjs/common';
import { Customer } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withRetry } from '../common/errors/retry';
import { env } from '../config/env';
import {
  DuplicateIdempotencyError,
  isUniqueKeyViolation,
} from '../consumption/consumption.repository.helpers';

/**
 * Outcome of a credit attempt. Mirrors the consume path's discriminated union so
 * the service can map each case to the right HTTP response / metric.
 */
export type CreditResult =
  | { status: 'ok'; customer: Customer }
  | { status: 'replayed'; customer: Customer }
  | { status: 'customer_not_found' };

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPage(
    limit: number,
    offset: number,
  ): Promise<{ rows: Customer[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.customer.count(),
    ]);
    return { rows, total };
  }

  findById(id: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({ where: { id } });
  }

  /**
   * Atomic, retry-safe, idempotent credit.
   *
   * Concurrency & consistency:
   *   The balance is changed with `{ increment }`, which compiles to
   *   `SET walletBalance = walletBalance + ?` — a single atomic statement, so
   *   concurrent top-ups can never lose each other (no read-modify-write race).
   *   The increment AND the CreditEvent ledger insert run inside ONE transaction,
   *   so the balance and its ledger record always commit together.
   *
   * Retry:
   *   The whole transaction is wrapped in `withRetry`, exactly like consume, so a
   *   transient SQLITE_BUSY under heavy concurrency is retried with backoff rather
   *   than surfaced. Safe because the increment is atomic (no partial state).
   *
   * Idempotency (Stripe-style, mirrors consume):
   *   If an idempotencyKey is supplied and we've seen it before, the original
   *   result is returned immediately — the wallet is NOT topped up again. If two
   *   concurrent requests race with the same key, the loser's CreditEvent insert
   *   hits the UNIQUE constraint, rolling back its increment; it then replays the
   *   winner's credit.
   *
   * Returns { status: 'customer_not_found' } when the customer does not exist —
   * the caller decides the error. `updateMany` never throws on "not found"; it
   * returns { count: 0 } instead, so no Prisma error codes leak out here.
   */
  async creditWallet(
    id: string,
    amountCents: number,
    idempotencyKey?: string | null,
  ): Promise<CreditResult> {
    // Fast path: replay without touching the wallet at all.
    if (idempotencyKey) {
      const replay = await this.replayIfProcessed(idempotencyKey);
      if (replay) return replay;
    }

    try {
      return await withRetry(() =>
        this.prisma.$transaction(
          async (tx): Promise<CreditResult> => {
            const { count } = await tx.customer.updateMany({
              where: { id },
              data: { walletBalance: { increment: amountCents } },
            });

            if (count === 0) return { status: 'customer_not_found' };

            try {
              await tx.creditEvent.create({
                data: { customerId: id, amount: amountCents, idempotencyKey },
              });
            } catch (error) {
              if (idempotencyKey && isUniqueKeyViolation(error)) {
                throw new DuplicateIdempotencyError(idempotencyKey);
              }
              throw error;
            }

            const customer = await tx.customer.findUniqueOrThrow({ where: { id } });
            return { status: 'ok', customer };
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

  private async replayIfProcessed(
    idempotencyKey: string,
  ): Promise<CreditResult | null> {
    const existing = await this.prisma.creditEvent.findUnique({
      where: { idempotencyKey },
    });
    if (!existing) return null;

    const customer = await this.prisma.customer.findUnique({
      where: { id: existing.customerId },
    });
    if (!customer) return null;

    return { status: 'replayed', customer };
  }
}
