import { useNavigate } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid2';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { formatCents } from '../utils/money';
import { getErrorMessage } from '../utils/error';
import { BalanceChip } from '../components/BalanceChip';
import { CountUp } from '../components/CountUp';
import { CustomerAvatar } from '../components/CustomerAvatar';
import { PageHeader } from '../components/PageHeader';
import { Pager } from '../components/Pager';
import { Reveal } from '../components/Reveal';
import { StatCard } from '../components/StatCard';
import { useCustomersPage } from './useCustomersPage';

export function CustomersPage() {
  const navigate = useNavigate();
  const {
    search,
    setSearch,
    customers: filtered,
    stats,
    isLoading,
    isError,
    error,
    currentPage,
    totalPages,
    total,
    goToPage,
  } = useCustomersPage();

  return (
    <Stack spacing={4}>
      <PageHeader
        title="Customers"
        subtitle="Monitor wallet balances and usage across your account base."
      />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Reveal delay={60}>
            <StatCard
              label="Customers"
              value={<CountUp value={stats.count} />}
              icon={<GroupsRoundedIcon />}
              hint={totalPages > 1 ? `page ${currentPage} of ${totalPages}` : 'all loaded'}
              loading={isLoading}
            />
          </Reveal>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Reveal delay={120}>
            <StatCard
              label="Total balance"
              value={<CountUp value={stats.totalBalance} format={formatCents} />}
              icon={<AccountBalanceWalletRoundedIcon />}
              tone="success"
              hint={`across ${stats.count} ${stats.count === 1 ? 'wallet' : 'wallets'}`}
              loading={isLoading}
            />
          </Reveal>
        </Grid>
      </Grid>

      {isError && (
        <Alert severity="error">
          {getErrorMessage(error, 'Failed to load customers.')}
        </Alert>
      )}

      <Card sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: 2 }}>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search loaded customers…"
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ maxWidth: 360 }}
          />
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell align="right">Wallet balance</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell width={48} />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Skeleton variant="circular" width={36} height={36} />
                        <Skeleton width={140} />
                      </Stack>
                    </TableCell>
                    <TableCell align="right"><Skeleton width={80} sx={{ ml: 'auto' }} /></TableCell>
                    <TableCell align="center"><Skeleton width={60} sx={{ mx: 'auto' }} /></TableCell>
                    <TableCell />
                  </TableRow>
                ))}

              {!isLoading &&
                filtered.map((c, i) => (
                  <TableRow
                    key={c.id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      animation: 'fadeInUp 460ms cubic-bezier(0.16, 1, 0.3, 1) both',
                      animationDelay: `${Math.min(i, 12) * 45}ms`,
                      '&:hover': {
                        backgroundColor: (theme) =>
                          alpha(theme.palette.primary.main, 0.05),
                      },
                      '&:hover .row-chevron': {
                        transform: 'translateX(3px)',
                        color: (theme) => theme.palette.primary.main,
                      },
                    }}
                    onClick={() => navigate(`/customers/${c.id}`)}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <CustomerAvatar name={c.name} />
                        <Typography fontWeight={600}>{c.name}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCents(c.walletBalance)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center"><BalanceChip cents={c.walletBalance} /></TableCell>
                    <TableCell>
                      <ChevronRightRoundedIcon
                        className="row-chevron"
                        fontSize="small"
                        sx={{
                          color: 'text.secondary',
                          display: 'block',
                          transition:
                            'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), color 200ms ease',
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}

              {!isLoading && filtered.length === 0 && !isError && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Typography color="text.secondary">
                        {search
                          ? `No customers match “${search}”.`
                          : 'No customers yet.'}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Pager
        currentPage={currentPage}
        totalPages={totalPages}
        onPage={goToPage}
        label={`Page ${currentPage} of ${totalPages} · ${total} customers`}
      />
    </Stack>
  );
}
