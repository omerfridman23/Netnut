import { type ReactNode } from 'react';
import { alpha } from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid2';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import { type Metrics } from '../api/types';
import { CountUp } from './CountUp';
import { Reveal } from './Reveal';
import { useSystemMetricsPanel } from './useSystemMetricsPanel';

/** Format an uptime in seconds as a compact "1h 3m" / "2m 50s" / "45s". */
function formatUptime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

type CounterTone = 'success' | 'secondary' | 'warning' | 'error';

interface ConsumeCounter {
  key: keyof Metrics['consume'];
  label: string;
  tooltip: string;
  tone: CounterTone;
  icon: ReactNode;
}

const CONSUME_COUNTERS: ConsumeCounter[] = [
  {
    key: 'ok',
    label: 'Charged',
    tooltip:
      'Successful usage events. Each one deducted money from the customer wallet and wrote one history row.',
    tone: 'success',
    icon: <CheckCircleRoundedIcon fontSize="small" />,
  },
  {
    key: 'replayed',
    label: 'Replayed',
    tooltip:
      'Idempotent retries. The request was already processed, so the original result was returned and the wallet was not charged again.',
    tone: 'secondary',
    icon: <ReplayRoundedIcon fontSize="small" />,
  },
  {
    key: 'insufficientFunds',
    label: 'Declined',
    tooltip:
      'Usage requests rejected because the wallet did not have enough balance. No money was deducted and no consumption event was written.',
    tone: 'warning',
    icon: <RemoveCircleOutlineRoundedIcon fontSize="small" />,
  },
  {
    key: 'notFound',
    label: 'Not found',
    tooltip:
      'Requests that referenced a missing customer or product. These are safely rejected without changing any wallet.',
    tone: 'error',
    icon: <SearchOffRoundedIcon fontSize="small" />,
  },
];

/** A single small consume-outcome tally. */
function CounterCell({
  label,
  value,
  tone,
  icon,
  tooltip,
}: {
  label: string;
  value: number;
  tone: CounterTone;
  icon: ReactNode;
  tooltip: string;
}) {
  return (
    <Tooltip title={tooltip} arrow placement="top">
      <Box
        sx={{
          p: 1.25,
          borderRadius: 2,
          border: (theme) => `1px solid ${theme.palette.divider}`,
          bgcolor: (theme) => alpha(theme.palette[tone].main, 0.06),
          height: '100%',
          cursor: 'help',
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: `${tone}.main` }}>
          {icon}
          <Typography variant="caption" sx={{ fontWeight: 700 }} color="text.secondary" noWrap>
            {label}
          </Typography>
        </Stack>
        <Typography variant="h6" sx={{ mt: 0.25, fontVariantNumeric: 'tabular-nums' }}>
          <CountUp value={value} />
        </Typography>
      </Box>
    </Tooltip>
  );
}

/** One card per backend replica. */
function ReplicaCard({ metrics, live }: { metrics: Metrics; live: boolean }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
            <Box
              aria-hidden
              sx={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                color: 'primary.main',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
              }}
            >
              <DnsRoundedIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" color="text.secondary" noWrap component="div">
                Backend replica
              </Typography>
              <Tooltip title={`Container ${metrics.instance}`}>
                <Typography
                  sx={{ fontFamily: 'monospace', fontWeight: 700, lineHeight: 1.2 }}
                  noWrap
                >
                  {metrics.instance}
                </Typography>
              </Tooltip>
            </Box>
          </Stack>

          <Chip
            size="small"
            color={live ? 'success' : 'default'}
            variant={live ? 'filled' : 'outlined'}
            label={live ? 'Live' : 'Last seen'}
            icon={
              <Box
                component="span"
                aria-hidden
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  ml: 1,
                  bgcolor: live ? 'common.white' : 'text.disabled',
                  animation: live ? 'pulseDot 2.4s ease-in-out infinite' : 'none',
                }}
              />
            }
          />
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Uptime{' '}
          <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {formatUptime(metrics.uptimeSeconds)}
          </Box>
        </Typography>

        {/* The headline concurrency signal. */}
        <Tooltip
          title="How many times the app-level retry safety net handled a SQLite busy-lock error. 0 is usually good: SQLite busy_timeout absorbed the contention before the app had to retry."
          arrow
          placement="top"
        >
          <Box
            sx={{
              mt: 1.5,
              p: 1.75,
              borderRadius: 2.5,
              border: (theme) => `1px solid ${alpha(theme.palette.info.main, 0.35)}`,
              bgcolor: (theme) => alpha(theme.palette.info.main, 0.08),
              cursor: 'help',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'info.main' }}>
              <StorageRoundedIcon fontSize="small" />
              <Typography variant="overline" sx={{ fontWeight: 700 }} color="text.secondary">
                DB lock retries
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="baseline" sx={{ mt: 0.25 }}>
              <Typography variant="h4" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                <CountUp value={metrics.db.retries} />
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {metrics.db.retriesExhausted > 0
                  ? `${metrics.db.retriesExhausted} exhausted`
                  : 'busy-lock retries handled cleanly'}
              </Typography>
            </Stack>
          </Box>
        </Tooltip>

        <Divider sx={{ my: 1.75 }} />

        <Typography variant="overline" color="text.secondary">
          Consumption outcomes
        </Typography>
        <Grid container spacing={1} sx={{ mt: 0.25 }}>
          {CONSUME_COUNTERS.map((c) => (
            <Grid size={6} key={c.key}>
              <CounterCell
                label={c.label}
                value={metrics.consume[c.key]}
                tone={c.tone}
                icon={c.icon}
                tooltip={c.tooltip}
              />
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}

/**
 * Live proof that the concurrency machinery is real: one card per backend
 * replica behind the gateway, surfacing each replica's uptime, consumption
 * outcome tallies, and — most importantly — its SQLite lock-retry counter.
 */
export function SystemMetricsPanel() {
  const { instances, isLoading, isError, isFetching, live, errorMessage } =
    useSystemMetricsPanel();

  return (
    <Stack spacing={2.5}>
      <Card
        sx={{
          p: { xs: 2, md: 2.5 },
          background: (theme) =>
            `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(
              theme.palette.primary.main,
              0.08,
            )} 100%)`,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Two replicas, one ledger
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Two backend replicas sit behind the gateway and share a single SQLite
          database. These counters are read live from each replica. Run{' '}
          <Box component="code" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
            npm run prove
          </Box>{' '}
          to drive concurrent load across both replicas and watch{' '}
          <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
            Charged
          </Box>{' '}
          and{' '}
          <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
            Replayed
          </Box>{' '}
          climb — while every charge stays exact and is never double-counted.{' '}
          <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
            DB lock retries
          </Box>{' '}
          stay at 0 because SQLite&apos;s <code>busy_timeout</code> absorbs write
          contention cleanly; the counter only rises under extreme sustained load.
          See{' '}
          <Box component="code" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
            docs/guides/testing.md
          </Box>
          .
        </Typography>
      </Card>

      {isError && instances.length === 0 && (
        <Alert severity="error">
          {errorMessage} The gateway may briefly return 503 while replicas restart —
          this panel will recover automatically.
        </Alert>
      )}

      {isError && instances.length > 0 && (
        <Alert severity="warning">
          Live refresh failed; showing the last-known values. Retrying…
        </Alert>
      )}

      <Grid container spacing={2.5} alignItems="stretch">
        {isLoading &&
          Array.from({ length: 2 }).map((_, i) => (
            <Grid size={{ xs: 12, md: 6 }} key={i}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Skeleton variant="rounded" width={40} height={40} />
                    <Box sx={{ flexGrow: 1 }}>
                      <Skeleton width={100} />
                      <Skeleton width={140} />
                    </Box>
                  </Stack>
                  <Skeleton variant="rounded" height={84} sx={{ mt: 2, borderRadius: 2.5 }} />
                  <Skeleton variant="rounded" height={120} sx={{ mt: 2, borderRadius: 2 }} />
                </CardContent>
              </Card>
            </Grid>
          ))}

        {!isLoading &&
          instances.map((m, i) => (
            <Grid size={{ xs: 12, md: 6 }} key={m.instance}>
              <Reveal delay={i * 80} sx={{ height: '100%' }}>
                <ReplicaCard metrics={m} live={live} />
              </Reveal>
            </Grid>
          ))}

        {!isLoading && !isError && instances.length === 0 && (
          <Grid size={12}>
            <Card>
              <CardContent>
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <DnsRoundedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">
                    No replicas have reported metrics yet.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      <Typography variant="caption" color="text.secondary">
        {instances.length > 0
          ? `Discovered ${instances.length} ${
              instances.length === 1 ? 'replica' : 'replicas'
            } · refreshing every 4s${isFetching ? ' · updating…' : ''}`
          : 'Polling the gateway…'}
      </Typography>
    </Stack>
  );
}
