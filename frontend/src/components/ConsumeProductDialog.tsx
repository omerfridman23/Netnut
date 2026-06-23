import { alpha } from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddShoppingCartRoundedIcon from '@mui/icons-material/AddShoppingCartRounded';
import { formatCents } from '../utils/money';
import { useConsumeProductDialog } from './useConsumeProductDialog';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optionally lock the dialog to a specific customer (from the detail page). */
  fixedCustomerId?: string;
}

export function ConsumeProductDialog({ open, onClose, fixedCustomerId }: Props) {
  const {
    customers,
    products,
    customersLoading,
    productsLoading,
    customerId,
    setCustomerId,
    productId,
    setProductId,
    quantity,
    setQuantity,
    qtyValid,
    estimatedCost,
    canSubmit,
    isPending,
    errorMessage,
    handleClose,
    handleSubmit,
  } = useConsumeProductDialog({ fixedCustomerId, onClose });

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            aria-hidden
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
            }}
          >
            <AddShoppingCartRoundedIcon fontSize="small" />
          </Box>
          <span>Record consumption</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

          {!fixedCustomerId && (
            <TextField
              select
              label="Customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              fullWidth
              helperText={customersLoading ? 'Loading customers...' : 'Who is consuming'}
            >
              {customers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name} — {formatCents(c.walletBalance)}
                </MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            select
            label="Product"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            fullWidth
            helperText={productsLoading ? 'Loading products...' : 'What is consumed'}
          >
            {products.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name} — {formatCents(p.unitPrice)}/unit
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputProps={{ min: 1, step: 1 }}
            error={quantity !== '' && !qtyValid}
            helperText={quantity !== '' && !qtyValid ? 'Enter a positive whole number' : ' '}
            fullWidth
          />

          {estimatedCost !== null && (
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{
                px: 2,
                py: 1.5,
                borderRadius: 2,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Estimated cost
              </Typography>
              <Typography variant="h6" color="primary.main">
                {formatCents(estimatedCost)}
              </Typography>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit || isPending}
        >
          {isPending ? 'Recording...' : 'Record'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
