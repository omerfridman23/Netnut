import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { useCreditWalletForm } from './useCreditWalletForm';

export function CreditWalletForm({ customerId }: { customerId: string }) {
  const { amount, errorMessage, isSuccess, isPending, handleSubmit, handleAmountChange } =
    useCreditWalletForm(customerId);

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={2}>
        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        {isSuccess && <Alert severity="success">Wallet credited.</Alert>}
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            label="Amount"
            value={amount}
            onChange={handleAmountChange}
            placeholder="25.00"
            inputMode="decimal"
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            sx={{ flexGrow: 1 }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={isPending}
            sx={{ height: 56, whiteSpace: 'nowrap' }}
          >
            {isPending ? 'Adding…' : 'Add funds'}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
