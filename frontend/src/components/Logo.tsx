import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import { gradients } from '../theme';

/** Brand mark + wordmark used in the app bar. */
export function Logo() {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      sx={{
        '&:hover .logo-mark': {
          transform: 'rotate(-8deg) scale(1.08)',
          boxShadow: (theme) => `0 10px 22px -6px ${theme.palette.primary.main}cc`,
        },
      }}
    >
      <Box
        aria-hidden
        className="logo-mark"
        sx={{
          width: 34,
          height: 34,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          background: gradients.brand,
          color: '#fff',
          boxShadow: (theme) =>
            `0 6px 16px -6px ${theme.palette.primary.main}aa`,
          transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 220ms ease',
        }}
      >
        <BoltRoundedIcon fontSize="small" />
      </Box>
      <Box sx={{ lineHeight: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
          Meter
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Usage Billing
        </Typography>
      </Box>
    </Stack>
  );
}
