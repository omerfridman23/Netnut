import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import { useColorMode } from '../providers/ColorModeProvider';

/** Single-button control that toggles between light and dark. */
export function ThemeToggle() {
  const { mode, toggle } = useColorMode();
  const next = mode === 'dark' ? 'light' : 'dark';

  return (
    <Tooltip title={`Switch to ${next} theme`}>
      <IconButton
        onClick={toggle}
        aria-label={`Switch to ${next} theme`}
        sx={{
          border: (theme) => `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
        }}
      >
        {mode === 'dark' ? (
          <DarkModeRoundedIcon fontSize="small" />
        ) : (
          <LightModeRoundedIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
}
