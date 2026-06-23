import { type ReactNode } from 'react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';

interface RevealProps {
  children: ReactNode;
  /** Stagger delay in ms (e.g. index * 60). */
  delay?: number;
  sx?: SxProps<Theme>;
}

/**
 * Fade-and-rise entrance wrapper. Uses a CSS keyframe (`fadeInUp`, defined
 * globally in the theme) so it costs nothing at runtime and is automatically
 * disabled under prefers-reduced-motion via the global guard.
 */
export function Reveal({ children, delay = 0, sx }: RevealProps) {
  return (
    <Box
      sx={{
        animation: 'fadeInUp 560ms cubic-bezier(0.16, 1, 0.3, 1) both',
        animationDelay: `${delay}ms`,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
