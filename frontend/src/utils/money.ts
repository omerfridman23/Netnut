/** Format integer cents as a USD string, e.g. 12490 -> "$124.90". */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/** Upper bound for a single wallet top-up, in cents ($1,000,000.00). Mirrors the backend. */
export const MAX_TOPUP_CENTS = 1_000_000_00;

export type ParseMoneyResult =
  | { ok: true; cents: number }
  | {
      ok: false;
      reason: 'empty' | 'not_a_number' | 'too_many_decimals' | 'not_positive' | 'too_large';
    };

/**
 * Parse a user-entered dollar amount (e.g. "12.50") into integer cents.
 * Returns a typed result so callers can show an accurate message for each
 * failure (rather than one vague "invalid amount").
 */
export function dollarsToCents(input: string): ParseMoneyResult {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: false, reason: 'empty' };
  // A number, optionally with a decimal part (any length — we check precision next).
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { ok: false, reason: 'not_a_number' };
  // Money has at most 2 decimal places; more would be sub-cent precision.
  if (/\.\d{3,}$/.test(trimmed)) return { ok: false, reason: 'too_many_decimals' };
  const cents = Math.round(Number.parseFloat(trimmed) * 100);
  if (cents <= 0) return { ok: false, reason: 'not_positive' };
  // Guard against absurd amounts before they reach the server.
  if (cents > MAX_TOPUP_CENTS) return { ok: false, reason: 'too_large' };
  return { ok: true, cents };
}

/** A draft money string while typing: digits, one optional dot, ≤ 2 decimals. */
export const MONEY_DRAFT_PATTERN = /^\d*(\.\d{0,2})?$/;

export const LOW_BALANCE_THRESHOLD_CENTS = Number.parseInt(
  import.meta.env.VITE_LOW_BALANCE_THRESHOLD_CENTS ?? '500',
  10,
);

export type BalanceStatus = 'empty' | 'low' | 'ok';

export function balanceStatus(cents: number): BalanceStatus {
  if (cents <= 0) return 'empty';
  if (cents <= LOW_BALANCE_THRESHOLD_CENTS) return 'low';
  return 'ok';
}
