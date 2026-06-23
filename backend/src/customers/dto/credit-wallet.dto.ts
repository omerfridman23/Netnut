import { Type } from 'class-transformer';
import { IsInt, IsPositive, Max } from 'class-validator';
import { MAX_TOPUP_CENTS, formatUsd } from '../../common/money';

/**
 * Body for crediting (topping up) a wallet.
 * Amount must be a positive integer number of cents. An upper bound guards
 * against absurd/overflow values.
 */
export class CreditWalletDto {
  @Type(() => Number)
  @IsInt({ message: 'amountCents must be an integer number of cents' })
  @IsPositive({ message: 'amountCents must be greater than 0' })
  @Max(MAX_TOPUP_CENTS, {
    message: ({ value }) =>
      `Top-up of ${typeof value === 'number' ? formatUsd(value) : 'that amount'} exceeds the maximum of ${formatUsd(MAX_TOPUP_CENTS)} per transaction.`,
  })
  amountCents!: number;
}
