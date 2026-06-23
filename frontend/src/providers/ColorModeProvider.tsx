import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createAppTheme, type ThemeMode } from '../theme';

interface ColorModeContextValue {
  /** The active color mode. */
  mode: ThemeMode;
  setMode: (next: ThemeMode) => void;
  /** Toggles between light and dark for the single-button switch. */
  toggle: () => void;
}

const STORAGE_KEY = 'billing.color-mode';
const DEFAULT_MODE: ThemeMode = 'dark';

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  // Any legacy value (including the old "system") falls back to the default.
  return stored === 'light' || stored === 'dark' ? stored : DEFAULT_MODE;
}

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const toggle = () => setMode(mode === 'dark' ? 'light' : 'dark');

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  // Keep the browser UI (mobile address bar) in sync with the active surface.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'dark' ? '#0b1020' : '#f6f7fb');
  }, [mode]);

  const value = useMemo<ColorModeContextValue>(
    () => ({ mode, setMode, toggle }),
    [mode],
  );

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export function useColorMode(): ColorModeContextValue {
  const ctx = useContext(ColorModeContext);
  if (!ctx) throw new Error('useColorMode must be used within a ColorModeProvider');
  return ctx;
}
