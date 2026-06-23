import { describe, expect, it, vi } from 'vitest';
import { withRetry } from '../../src/common/errors/retry';

/**
 * Unit test (no database, no HTTP) for the transient-error retry helper.
 *
 * The retry path is part of how we stay consistent under contention: a rare
 * SQLITE_BUSY must be retried (the write is one atomic transaction, so it is
 * safe), but a genuine error must surface immediately and NOT be retried.
 */
describe('withRetry', () => {
  const busyError = () => Object.assign(new Error('database is locked'), {});

  it('returns the result without retrying when the function succeeds', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on a transient SQLITE_BUSY error, then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(busyError())
      .mockRejectedValueOnce(busyError())
      .mockResolvedValue('recovered');

    const result = await withRetry(fn, { retries: 5, baseDelayMs: 1 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3); // 2 failures + 1 success
  });

  it('does NOT retry a non-transient error and rethrows immediately', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('insufficient funds'));

    await expect(withRetry(fn, { retries: 5, baseDelayMs: 1 })).rejects.toThrow(
      'insufficient funds',
    );
    expect(fn).toHaveBeenCalledTimes(1); // tried once, gave up
  });

  it('gives up after exhausting retries on persistent contention', async () => {
    const fn = vi.fn().mockRejectedValue(busyError());

    await expect(withRetry(fn, { retries: 2, baseDelayMs: 1 })).rejects.toThrow(
      'database is locked',
    );
    expect(fn).toHaveBeenCalledTimes(3); // initial try + 2 retries
  });
});
