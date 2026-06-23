import { Injectable } from '@nestjs/common';
import { Customer } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withRetry } from '../common/errors/retry';
import { env } from '../config/env';
import {
  DuplicateIdempotencyError,
  isUniqueKeyViolation,
} from '../consumption/consumption.repository.helpers';
import { CreditResult } from './customers.types';

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
   * Atomic, retry-safe, idempotent credit (wallet top-up).
   *
   * The balance is incremented with `{ increment }` (a single atomic SQL
   * statement, so concurrent top-ups never lose each other) AND a CREDIT row is
   * written to the unified WalletTransaction ledger (positive `amount`) in the
   * SAME transaction. Idempotency mirrors consume: a repeat key replays the
   * original result without topping up again; a concurrent duplicate hits the
   * UNIQUE key, rolls back its increment, and replays the winner.
   */
  async creditWallet(
    id: string,
    amountCents: number,
    idempotencyKey?: string | null,
  ): Promise<CreditResult> {
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
              await tx.walletTransaction.create({
                data: { customerId: id, type: 'CREDIT', amount: amountCents, idempotencyKey },
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
    const existing = await this.prisma.walletTransaction.findUnique({
      where: { idempotencyKey },
    });
    // Only replay a CREDIT here; a key reused for a different op type won't match.
    if (!existing || existing.type !== 'CREDIT') return null;

    const customer = await this.prisma.customer.findUnique({
      where: { id: existing.customerId },
    });
    if (!customer) return null;

    return { status: 'replayed', customer };
  }
}
