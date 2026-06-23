import { alpha, createTheme, type Theme } from '@mui/material/styles';

export type ThemeMode = 'light' | 'dark';

/**
 * Brand + design tokens shared across both color modes. Keeping these in one
 * place means components can stay declarative and free of magic values.
 */
const brand = {
  indigo: '#4f46e5',
  indigoSoft: '#6366f1',
  violet: '#7c3aed',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#ef4444',
  sky: '#0ea5e9',
};

export const gradients = {
  brand: `linear-gradient(135deg, ${brand.indigoSoft} 0%, ${brand.violet} 100%)`,
  brandSoft: `linear-gradient(135deg, ${alpha(brand.indigoSoft, 0.12)} 0%, ${alpha(
    brand.violet,
    0.12,
  )} 100%)`,
};

const fontFamily =
  '"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Mode-specific surface + shadow tokens. */
function tokens(mode: ThemeMode) {
  const isDark = mode === 'dark';
  return {
    appBg: isDark
      ? `radial-gradient(1200px 600px at 100% -10%, ${alpha(
          brand.violet,
          0.18,
        )} 0%, transparent 60%), radial-gradient(1000px 600px at -10% 0%, ${alpha(
          brand.indigoSoft,
          0.16,
        )} 0%, transparent 55%), #0b1020`
      : `radial-gradient(1200px 600px at 100% -10%, ${alpha(
          brand.violet,
          0.08,
        )} 0%, transparent 60%), radial-gradient(1000px 600px at -10% 0%, ${alpha(
          brand.indigoSoft,
          0.1,
        )} 0%, transparent 55%), #f6f7fb`,
    paper: isDark ? '#141a2e' : '#ffffff',
    paperElevated: isDark ? '#1a2138' : '#ffffff',
    border: isDark ? alpha('#ffffff', 0.08) : alpha('#0b1020', 0.08),
    glass: isDark ? alpha('#0b1020', 0.72) : alpha('#ffffff', 0.72),
    cardShadow: isDark
      ? '0 1px 2px rgba(0,0,0,0.4), 0 12px 32px -12px rgba(0,0,0,0.6)'
      : '0 1px 2px rgba(16,24,40,0.04), 0 12px 32px -16px rgba(16,24,40,0.18)',
    buttonShadow: `0 8px 20px -8px ${alpha(brand.indigo, 0.6)}`,
  };
}

export function createAppTheme(mode: ThemeMode): Theme {
  const isDark = mode === 'dark';
  const t = tokens(mode);

  return createTheme({
    palette: {
      mode,
      primary: { main: brand.indigo, light: brand.indigoSoft },
      secondary: { main: brand.violet },
      success: { main: brand.emerald },
      warning: { main: brand.amber },
      error: { main: brand.rose },
      info: { main: brand.sky },
      background: {
        default: isDark ? '#0b1020' : '#f6f7fb',
        paper: t.paper,
      },
      text: {
        primary: isDark ? '#e6e9f5' : '#0f172a',
        secondary: isDark ? alpha('#e6e9f5', 0.62) : alpha('#0f172a', 0.6),
      },
      divider: t.border,
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily,
      h4: { fontWeight: 800, letterSpacing: '-0.02em' },
      h5: { fontWeight: 800, letterSpacing: '-0.02em' },
      h6: { fontWeight: 700, letterSpacing: '-0.01em' },
      subtitle2: { fontWeight: 600 },
      button: { fontWeight: 600 },
      overline: { fontWeight: 700, letterSpacing: '0.08em' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: t.appBg,
            backgroundAttachment: 'fixed',
            minHeight: '100vh',
          },
          '::selection': {
            background: alpha(brand.indigoSoft, 0.28),
          },
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: t.border,
            borderRadius: 8,
          },
          '@keyframes fadeInUp': {
            from: { opacity: 0, transform: 'translateY(12px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
          '@keyframes fadeIn': {
            from: { opacity: 0 },
            to: { opacity: 1 },
          },
          '@keyframes pulseDot': {
            '0%': { boxShadow: `0 0 0 0 ${alpha(brand.emerald, 0.5)}` },
            '70%': { boxShadow: `0 0 0 6px ${alpha(brand.emerald, 0)}` },
            '100%': { boxShadow: `0 0 0 0 ${alpha(brand.emerald, 0)}` },
          },
          '@keyframes shimmer': {
            '100%': { transform: 'translateX(100%)' },
          },
          // Respect users who ask for less motion: neutralize all animation.
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.001ms !important',
              animationIterationCount: '1 !important',
              transitionDuration: '0.001ms !important',
              scrollBehavior: 'auto !important',
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            color: isDark ? '#e6e9f5' : '#0f172a',
            background: t.glass,
            backdropFilter: 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            borderBottom: `1px solid ${t.border}`,
            boxShadow: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: t.border },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${t.border}`,
            borderRadius: 18,
            boxShadow: t.cardShadow,
            backgroundColor: t.paperElevated,
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 12,
            paddingInline: 18,
            transition:
              'transform 140ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms ease, filter 200ms ease, background-position 400ms ease',
            '&:active': { transform: 'scale(0.97)' },
          },
          containedPrimary: {
            backgroundImage: gradients.brand,
            backgroundSize: '180% 180%',
            backgroundPosition: '0% 50%',
            boxShadow: t.buttonShadow,
            '&:hover': {
              boxShadow: `0 12px 28px -8px ${alpha(brand.indigo, 0.7)}`,
              backgroundPosition: '100% 50%',
              transform: 'translateY(-1px)',
            },
          },
          outlined: {
            borderColor: t.border,
            '&:hover': { transform: 'translateY(-1px)' },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1), background-color 160ms ease',
            '&:hover': { transform: 'translateY(-1px) scale(1.06)' },
            '&:active': { transform: 'scale(0.94)' },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, borderRadius: 8 },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: isDark ? alpha('#ffffff', 0.03) : '#fff',
            transition: 'box-shadow 200ms ease, border-color 200ms ease',
            '&.Mui-focused': {
              boxShadow: `0 0 0 4px ${alpha(brand.indigo, 0.15)}`,
            },
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: { root: { borderRadius: 18 } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: t.border },
          head: {
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: isDark ? alpha('#e6e9f5', 0.6) : alpha('#0f172a', 0.55),
            backgroundColor: isDark ? alpha('#ffffff', 0.02) : alpha('#0f172a', 0.015),
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 120ms ease',
            '&:last-of-type td': { borderBottom: 'none' },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 20,
            border: `1px solid ${t.border}`,
            backgroundImage: 'none',
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { borderRadius: 8, fontSize: 12, fontWeight: 500 },
        },
      },
    },
  });
}
