import { Prisma } from '@prisma/client';

/**
 * Thrown inside a transaction when a concurrent request with the same
 * idempotency key wins the race to insert first. Throwing causes the
 * transaction to roll back — including the balance decrement that already
 * ran — so the customer is never double-charged. The caller then replays
 * the winner's stored event instead.
 *
 * This is intentionally NOT retried by withRetry (see retry.ts).
 */
export class DuplicateIdempotencyError extends Error {
  constructor(readonly key: string) {
    super(`Duplicate idempotency key: ${key}`);
    this.name = 'DuplicateIdempotencyError';
  }
}

/** Returns true when an error is Prisma's "unique constraint failed" (P2002). */
export function isUniqueKeyViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  );
}
