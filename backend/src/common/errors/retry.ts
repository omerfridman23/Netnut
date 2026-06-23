/**
 * Retry helper for transient SQLite write contention.
 *
 * Even with busy_timeout, under very high concurrency SQLite can still surface a
 * SQLITE_BUSY / "database is locked" error. Those are safe to retry because our
 * write path is a single atomic transaction (no partial state to clean up).
 *
 * Backoff strategy: "full jitter" exponential backoff (AWS Architecture Blog).
 * Each retry waits a random delay in [0, ceiling), where the ceiling grows
 * exponentially but is capped at maxDelayMs. Choosing a random point across the
 * whole window — rather than a fixed delay plus a little noise — scatters
 * competing writers far more effectively, so they stop colliding on the lock.
 */
import { env } from '../../config/env';
import { recordRetry, recordRetryExhausted } from '../metrics/metrics.store';

function isRetryableSqliteError(error: unknown): boolean {
  const message = (error as { message?: string })?.message?.toLowerCase() ?? '';
  const code = (error as { code?: string })?.code ?? '';
  return (
    message.includes('database is locked') ||
    message.includes('database table is locked') ||
    message.includes('sqlite_busy') ||
    code === 'SQLITE_BUSY' ||
    code === 'P2034' // Prisma: "Transaction failed due to a write conflict or a deadlock"
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; baseDelayMs?: number; maxDelayMs?: number } = {},
): Promise<T> {
  const retries = options.retries ?? env.dbRetries;
  const baseDelayMs = options.baseDelayMs ?? env.dbRetryBaseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? env.dbRetryMaxDelayMs;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryableSqliteError(error)) {
        throw error;
      }
      if (attempt === retries) {
        recordRetryExhausted();
        throw error;
      }
      recordRetry();
      // Full jitter: pick a random delay across the whole (capped) backoff window.
      const ceiling = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      await sleep(Math.random() * ceiling);
    }
  }

  // Unreachable: the loop always returns or throws on the final attempt.
  throw new Error('withRetry: exhausted retries without returning');
}
