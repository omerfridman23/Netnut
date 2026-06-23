import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { balanceStatus } from '../utils/money';

/**
 * Status indicator for a wallet balance. We only raise visual weight for the
 * exceptions that need action — a healthy wallet stays quiet (a small dot),
 * so a list of mostly-healthy customers doesn't become a wall of green.
 *
 *   empty -> red "Empty" chip
 *   low   -> amber "Low" chip
 *   ok    -> subtle green dot + "Active"
 */
export function BalanceChip({ cents }: { cents: number }) {
  const status = balanceStatus(cents);

  if (status === 'empty') {
    return (
      <Chip
        size="small"
        color="error"
        variant="filled"
        icon={<ErrorOutlineRoundedIcon />}
        label="Empty"
      />
    );
  }

  if (status === 'low') {
    return (
      <Chip
        size="small"
        color="warning"
        variant="outlined"
        icon={<WarningAmberRoundedIcon />}
        label="Low"
      />
    );
  }

  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      justifyContent="center"
      component="span"
    >
      <Box
        component="span"
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: 'success.main',
          animation: 'pulseDot 2.4s ease-in-out infinite',
        }}
      />
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        Active
      </Typography>
    </Stack>
  );
}
