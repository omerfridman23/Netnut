import { useState } from 'react';
import { useCreditWallet } from '../api/hooks';
import {
  dollarsToCents,
  formatCents,
  MAX_TOPUP_CENTS,
  MONEY_DRAFT_PATTERN,
} from '../utils/money';
import { getErrorMessage } from '../utils/error';

const VALIDATION_MESSAGES = {
  empty: 'Enter an amount to add.',
  not_a_number: 'Enter a valid dollar amount (e.g. 25.00).',
  too_many_decimals: 'Use at most 2 decimal places (e.g. 25.00).',
  not_positive: 'Amount must be greater than 0.',
  too_large: `Amount must be ${formatCents(MAX_TOPUP_CENTS)} or less.`,
} as const;

/**
 * Owns all the state and behaviour for crediting a wallet, keeping
 * `CreditWalletForm` a pure render. Validates input, fires the mutation, and
 * exposes a single error string plus the flags the view needs.
 */
export function useCreditWalletForm(customerId: string) {
  const [amount, setAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const credit = useCreditWallet(customerId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Clear any prior outcome (success or server error) so we never show two
    // conflicting alerts at once.
    setValidationError(null);
    credit.reset();
    const result = dollarsToCents(amount);
    if (!result.ok) {
      setValidationError(VALIDATION_MESSAGES[result.reason]);
      return;
    }
    credit.mutate(result.cents, { onSuccess: () => setAmount('') });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    // Reject input that isn't a valid money draft (e.g. a 3rd decimal place or
    // letters), so the 2-decimal rule is enforced as the user types.
    if (next !== '' && !MONEY_DRAFT_PATTERN.test(next)) return;
    setAmount(next);
    // Editing the field invalidates the previous result, so dismiss stale alerts.
    if (validationError) setValidationError(null);
    if (credit.isSuccess || credit.isError) credit.reset();
  };

  const errorMessage =
    validationError ??
    (credit.error
      ? getErrorMessage(credit.error, 'Could not credit wallet. Please try again.')
      : null);

  return {
    amount,
    errorMessage,
    isSuccess: credit.isSuccess && !credit.isPending,
    isPending: credit.isPending,
    handleSubmit,
    handleAmountChange,
  };
}
