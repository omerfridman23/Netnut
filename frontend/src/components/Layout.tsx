import { type ReactNode, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';
import { ConsumeProductDialog } from './ConsumeProductDialog';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

export function Layout({ children }: { children: ReactNode }) {
  const [consumeOpen, setConsumeOpen] = useState(false);
  const location = useLocation();

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="sticky">
        <Container maxWidth="lg" disableGutters>
          <Toolbar sx={{ gap: 1.5 }}>
            <Box
              component={RouterLink}
              to="/"
              sx={{ textDecoration: 'none', color: 'inherit', flexGrow: 1 }}
            >
              <Logo />
            </Box>

            <Stack direction="row" spacing={1.25} alignItems="center">
              <Button
                component={RouterLink}
                to="/system"
                color="inherit"
                startIcon={<MonitorHeartRoundedIcon />}
                aria-current={location.pathname === '/system' ? 'page' : undefined}
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  fontWeight: location.pathname === '/system' ? 700 : 600,
                  color: location.pathname === '/system' ? 'primary.main' : 'text.secondary',
                }}
              >
                Live proof
              </Button>
              <Button
                component={RouterLink}
                to="/system"
                color="inherit"
                aria-label="Live proof"
                aria-current={location.pathname === '/system' ? 'page' : undefined}
                sx={{
                  display: { xs: 'inline-flex', sm: 'none' },
                  minWidth: 0,
                  px: 1.25,
                  color: location.pathname === '/system' ? 'primary.main' : 'text.secondary',
                }}
              >
                <MonitorHeartRoundedIcon />
              </Button>
              <ThemeToggle />
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() => setConsumeOpen(true)}
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
              >
                Record consumption
              </Button>
              <Button
                variant="contained"
                onClick={() => setConsumeOpen(true)}
                aria-label="Record consumption"
                sx={{ display: { xs: 'inline-flex', sm: 'none' }, minWidth: 0, px: 1.5 }}
              >
                <AddRoundedIcon />
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        {/* Re-keying on pathname replays the entrance animation on each route change. */}
        <Box
          key={location.pathname}
          sx={{ animation: 'fadeIn 320ms ease both' }}
        >
          {children}
        </Box>
      </Container>

      <ConsumeProductDialog open={consumeOpen} onClose={() => setConsumeOpen(false)} />
    </Box>
  );
}
