/**
 * Centralized, validated environment configuration.
 *
 * Reading env vars in exactly one place keeps configuration predictable and makes
 * it obvious which knobs the service exposes. Values are parsed and defaulted here
 * so the rest of the code works with clean, typed values.
 */

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got "${raw}"`);
  }
  return parsed;
}

export const env = {
  port: intFromEnv('PORT', 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Note: DATABASE_URL is read directly by Prisma from the environment, so it is
  // intentionally not duplicated here.

  // ---------------------------------------------------------------------------
  // SQLite contention-tuning knobs — all in one place so they're easy to tune.
  // ---------------------------------------------------------------------------

  /** How long SQLite waits for a write lock before surfacing SQLITE_BUSY. */
  busyTimeoutMs: intFromEnv('BUSY_TIMEOUT_MS', 5_000),

  /**
   * How long Prisma waits to acquire a connection from the pool, and the
   * maximum wall-clock time a transaction may hold its connection.
   * With connection_limit=1 these are effectively "queue wait" and "max tx duration".
   */
  txMaxWaitMs: intFromEnv('TX_MAX_WAIT_MS', 20_000),
  txTimeoutMs: intFromEnv('TX_TIMEOUT_MS', 20_000),

  /** Maximum number of retries on transient SQLITE_BUSY errors. */
  dbRetries: intFromEnv('DB_RETRIES', 5),

  /** Base delay (ms) for exponential backoff between retries. */
  dbRetryBaseDelayMs: intFromEnv('DB_RETRY_BASE_DELAY_MS', 25),

  /** Upper bound (ms) on a single backoff wait, so exponential growth stays sane. */
  dbRetryMaxDelayMs: intFromEnv('DB_RETRY_MAX_DELAY_MS', 1_000),

  /**
   * Comma-separated list of allowed CORS origins, e.g. "https://app.example.com".
   * Defaults to wildcard (*) in development, which is safe because the app is not
   * publicly exposed. In production, set this to the exact frontend origin.
   */
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean),
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  },
};
