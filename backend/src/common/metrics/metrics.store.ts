/**
 * Tiny in-process metrics store.
 *
 * Makes the concurrency machinery *visible*: how often SQLite write contention
 * forced a retry, how many retries eventually gave up, and the outcome mix of
 * the consume path. Exposed read-only via GET /api/metrics.
 *
 * Note: counters are per-process. With multiple backend replicas, each instance
 * reports its own numbers — the /api/metrics response includes the instance
 * hostname so it is clear which replica answered.
 */
export interface Metrics {
  /** Consume requests that charged the wallet. */
  consumeOk: number;
  /** Consume requests replayed from an idempotency key (no charge). */
  consumeReplayed: number;
  /** Consume requests rejected for insufficient funds. */
  consumeInsufficient: number;
  /** Consume requests for a missing customer. */
  consumeNotFound: number;
  /** Credit requests that topped up the wallet. */
  creditOk: number;
  /** Credit requests replayed from an idempotency key (no top-up). */
  creditReplayed: number;
  /** Times a transient SQLITE_BUSY forced a backoff + retry. */
  dbRetries: number;
  /** Times retries were exhausted and the error surfaced. */
  dbRetryExhausted: number;
  /** Process start time (ms epoch), for uptime. */
  startedAt: number;
}

export const metrics: Metrics = {
  consumeOk: 0,
  consumeReplayed: 0,
  consumeInsufficient: 0,
  consumeNotFound: 0,
  creditOk: 0,
  creditReplayed: 0,
  dbRetries: 0,
  dbRetryExhausted: 0,
  startedAt: Date.now(),
};

export function recordRetry(): void {
  metrics.dbRetries += 1;
}

export function recordRetryExhausted(): void {
  metrics.dbRetryExhausted += 1;
}

export type ConsumeOutcome = 'ok' | 'replayed' | 'insufficient' | 'not_found';

export function recordConsume(outcome: ConsumeOutcome): void {
  switch (outcome) {
    case 'ok':
      metrics.consumeOk += 1;
      break;
    case 'replayed':
      metrics.consumeReplayed += 1;
      break;
    case 'insufficient':
      metrics.consumeInsufficient += 1;
      break;
    case 'not_found':
      metrics.consumeNotFound += 1;
      break;
  }
}

export type CreditOutcome = 'ok' | 'replayed';

export function recordCredit(outcome: CreditOutcome): void {
  switch (outcome) {
    case 'ok':
      metrics.creditOk += 1;
      break;
    case 'replayed':
      metrics.creditReplayed += 1;
      break;
  }
}
