import { type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

type Tone = 'primary' | 'success' | 'warning' | 'error';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: Tone;
  /** Optional supporting line under the value for extra context. */
  hint?: ReactNode;
  loading?: boolean;
}

/** Compact KPI tile with a tinted icon badge and optional hint. */
export function StatCard({
  label,
  value,
  icon,
  tone = 'primary',
  hint,
  loading,
}: StatCardProps) {
  return (
    <Card
      sx={{
        p: 2.5,
        height: '100%',
        transition:
          'transform 240ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 240ms ease, border-color 240ms ease',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: (theme) => `0 18px 40px -20px ${alpha(theme.palette[tone].main, 0.5)}`,
          borderColor: (theme) => alpha(theme.palette[tone].main, 0.4),
        },
        '&:hover .stat-icon': {
          transform: 'scale(1.08) rotate(-4deg)',
        },
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          aria-hidden
          className="stat-icon"
          sx={{
            flexShrink: 0,
            width: 48,
            height: 48,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            color: (theme) => theme.palette[tone].main,
            bgcolor: (theme) => alpha(theme.palette[tone].main, 0.12),
            transition: 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary" noWrap>
            {label}
          </Typography>
          {loading ? (
            <Skeleton width={96} height={32} />
          ) : (
            <Typography
              variant="h5"
              noWrap
              sx={{ lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}
            >
              {value}
            </Typography>
          )}
          {hint && !loading && (
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {hint}
            </Typography>
          )}
        </Box>
      </Stack>
    </Card>
  );
}
