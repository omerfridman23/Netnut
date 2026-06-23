import { Customer } from '@prisma/client';

/**
 * Discriminated union returned by the repository's creditWallet method.
 * The service translates each case into the appropriate HTTP response / metric.
 * Mirrors the consume path's ConsumeResult.
 */
export type CreditResult =
  | { status: 'ok'; customer: Customer }
  | { status: 'replayed'; customer: Customer }
  | { status: 'customer_not_found' };
