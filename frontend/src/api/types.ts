// These mirror the backend DTOs. Money fields are always integer CENTS.

export interface Product {
  id: string;
  name: string;
  unitPrice: number;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  walletBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConsumptionEvent {
  id: string;
  customerId: string;
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  createdAt: string;
}

export interface ConsumptionResult {
  event: ConsumptionEvent;
  walletBalance: number;
  // True when the server replayed an earlier identical request (same
  // Idempotency-Key) instead of charging again.
  replayed: boolean;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
  };
}

/**
 * Runtime metrics reported by a single backend replica (`GET /metrics`).
 * The shape is stable, but the backend may add fields later — only read the
 * ones declared here and tolerate extras.
 */
export interface Metrics {
  /** Container id of the replica that served this response. */
  instance: string;
  uptimeSeconds: number;
  /** Outcome tallies for consumption requests handled by this replica. */
  consume: {
    ok: number;
    replayed: number;
    insufficientFunds: number;
    notFound: number;
  };
  db: {
    /** SQLite busy/lock retries — the live concurrency-contention signal. */
    retries: number;
    /** Requests that gave up after exhausting the retry budget. */
    retriesExhausted: number;
  };
}
