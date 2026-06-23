/** Format integer cents as a human-readable USD string, e.g. 492920 -> "$4,929.20". */
export function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/** Upper bound for a single wallet top-up, in cents ($1,000,000.00). */
export const MAX_TOPUP_CENTS = 1_000_000_00;
