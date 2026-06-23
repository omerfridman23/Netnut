import { WalletTransaction } from '@prisma/client';

// ---------------------------------------------------------------------------
// Internal types — used by the repository and service, never sent over the wire
// ---------------------------------------------------------------------------

/** Transaction kinds stored in the unified WalletTransaction ledger. */
export type TransactionType = 'CREDIT' | 'CONSUME';

/** Input to the consume repository method. */
export interface ConsumeParams {
  customerId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  /**
   * Optional Stripe-style idempotency key. When present, a retry carrying the
   * same key returns the original outcome without touching the wallet again.
   */
  idempotencyKey?: string | null;
}

/** A WalletTransaction row with its (optional) product name joined in. */
export type EventWithProduct = WalletTransaction & {
  product: { name: string } | null;
};

/**
 * Discriminated union returned by the repository's consume method.
 * The service translates each case into the appropriate HTTP response.
 */
export type ConsumeResult =
  | { status: 'ok'; event: EventWithProduct; walletBalance: number }
  | { status: 'replayed'; event: EventWithProduct; walletBalance: number }
  | { status: 'customer_not_found' }
  | { status: 'insufficient_funds'; available: number };
