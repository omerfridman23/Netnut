import { type ReactNode } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid2';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import { formatCents } from '../utils/money';
import { formatDateTime } from '../utils/datetime';
import { getErrorMessage } from '../utils/error';
import { BalanceChip } from '../components/BalanceChip';
import { CountUp } from '../components/CountUp';
import { CustomerAvatar } from '../components/CustomerAvatar';
import { CreditWalletForm } from '../components/CreditWalletForm';
import { ConsumeProductDialog } from '../components/ConsumeProductDialog';
import { Pager } from '../components/Pager';
import { Reveal } from '../components/Reveal';
import { useCustomerDetailPage } from './useCustomerDetailPage';

function HeroMetric({
  label,
  value,
  loading,
}: {
  label: string;
  value: ReactNode;
  loading?: boolean;
}) {
  return (
    <Box sx={{ minWidth: 96 }}>
      <Typography variant="overline" color="text.secondary" noWrap>
        {label}
      </Typography>
      {loading ? (
        <Skeleton width={72} height={28} />
      ) : (
        <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }} noWrap>
          {value}
        </Typography>
      )}
    </Box>
  );
}

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const {
    customer,
    isLoading,
    isError,
    isNotFound,
    errorMessage,
    history,
    events,
    metrics,
    currentPage,
    totalPages,
    goToPage,
    consumeOpen,
    openConsume,
    closeConsume,
  } = useCustomerDetailPage(id);

  if (isError) {
    return (
      <Stack spacing={2}>
        <Alert severity={isNotFound ? 'warning' : 'error'}>{errorMessage}</Alert>
        <Link component={RouterLink} to="/">
          Back to customers
        </Link>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Breadcrumbs>
        <Link component={RouterLink} to="/" underline="hover" color="inherit">
          Customers
        </Link>
        <Typography color="text.primary" fontWeight={600}>
          {customer ? customer.name : <Skeleton width={120} />}
        </Typography>
      </Breadcrumbs>

      {/* Finance hero: identity + balance + inline KPIs */}
      <Reveal delay={40}>
      <Card
        sx={{
          p: { xs: 2.5, md: 3 },
          backgroundColor: 'transparent',
          background: (theme) =>
            `radial-gradient(900px 300px at 100% -40%, ${alpha(
              theme.palette.secondary.main,
              0.16,
            )} 0%, transparent 70%), linear-gradient(135deg, ${alpha(
              theme.palette.primary.main,
              0.14,
            )} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
          backgroundSize: '160% 160%',
          animation: 'heroPan 18s ease-in-out infinite alternate',
          '@keyframes heroPan': {
            from: { backgroundPosition: '0% 50%' },
            to: { backgroundPosition: '100% 50%' },
          },
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            {customer ? (
              <CustomerAvatar name={customer.name} size={56} />
            ) : (
              <Skeleton variant="circular" width={56} height={56} />
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Wallet balance
              </Typography>
              {isLoading ? (
                <Skeleton width={200} height={48} />
              ) : (
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                  <Typography
                    variant="h4"
                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    <CountUp value={customer!.walletBalance} format={formatCents} />
                  </Typography>
                  <BalanceChip cents={customer!.walletBalance} />
                </Stack>
              )}
              <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.25 }}>
                {customer ? customer.name : <Skeleton width={140} />}
              </Typography>
            </Box>
          </Stack>

          <Stack
            direction="row"
            spacing={3}
            divider={<Divider orientation="vertical" flexItem />}
          >
            <HeroMetric
              label="Page spend"
              value={<CountUp value={metrics.pageTotal} format={formatCents} />}
              loading={history.isLoading}
            />
            <HeroMetric
              label="Total events"
              value={<CountUp value={metrics.count} />}
              loading={history.isLoading}
            />
          </Stack>
        </Stack>
      </Card>
      </Reveal>

      <Grid container spacing={3} alignItems="stretch">
        {/* Left column: actions */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Reveal delay={140} sx={{ height: '100%' }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Add funds
              </Typography>
              <CreditWalletForm customerId={id} />
              <Divider sx={{ my: 2.5 }} />
              <Button
                variant="outlined"
                startIcon={<AddRoundedIcon />}
                onClick={openConsume}
                fullWidth
              >
                Record consumption
              </Button>
            </CardContent>
          </Card>
          </Reveal>
        </Grid>

        {/* Right column: activity */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Reveal delay={220} sx={{ height: '100%' }}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ p: 2.5, pb: 1.5, color: 'text.secondary' }}
            >
              <ReceiptLongRoundedIcon fontSize="small" />
              <Typography variant="subtitle2" color="text.primary">
                Consumption history
              </Typography>
            </Stack>

            {history.isError && (
              <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>
                {getErrorMessage(history.error, 'Failed to load history.')}
              </Alert>
            )}

            <TableContainer sx={{ flexGrow: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Unit</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.isLoading &&
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={5}><Skeleton /></TableCell>
                      </TableRow>
                    ))}

                  {!history.isLoading &&
                    events.map((e, i) => (
                      <TableRow
                        key={e.id}
                        hover
                        sx={{
                          animation: 'fadeInUp 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
                          animationDelay: `${Math.min(i, 12) * 40}ms`,
                        }}
                      >
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {formatDateTime(e.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {e.productName ?? e.productId}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {e.quantity}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {formatCents(e.unitPrice)}
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {formatCents(e.totalCost)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}

                  {!history.isLoading && events.length === 0 && !history.isError && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Box sx={{ py: 8, textAlign: 'center' }}>
                          <ReceiptLongRoundedIcon
                            sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }}
                          />
                          <Typography color="text.secondary">
                            No consumption history yet.
                          </Typography>
                          <Button
                            size="small"
                            startIcon={<AddRoundedIcon />}
                            onClick={openConsume}
                            sx={{ mt: 1 }}
                          >
                            Record the first event
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Pager
              currentPage={currentPage}
              totalPages={totalPages}
              onPage={goToPage}
              size="small"
            />
          </Card>
          </Reveal>
        </Grid>
      </Grid>

      <ConsumeProductDialog
        open={consumeOpen}
        onClose={closeConsume}
        fixedCustomerId={id}
      />
    </Stack>
  );
}
