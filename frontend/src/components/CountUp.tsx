import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

interface CountUpProps {
  /** Target value to animate to. */
  value: number;
  /** Formats the (animated) numeric value for display. Defaults to integer string. */
  format?: (n: number) => string;
  /** Animation duration in ms. */
  duration?: number;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animates a number from its previous value to the new one with an ease-out
 * curve. Animating on change means actions like "add funds" visibly tick the
 * balance up. Honors prefers-reduced-motion by snapping to the final value.
 */
export function CountUp({ value, format = (n) => String(Math.round(n)), duration = 900 }: CountUpProps) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }

    const from = fromRef.current;
    const delta = value - from;
    if (delta === 0) return;

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(from + delta * easeOut(progress));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      fromRef.current = value;
    };
  }, [value, duration, reduced]);

  return <>{format(display)}</>;
}
