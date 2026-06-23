import { useMetrics } from '../api/hooks';
import { getErrorMessage } from '../utils/error';

// A refresh older than this is considered stale, so the panel stops claiming
// the replicas are "live".
const LIVE_WINDOW_MS = 12_000;

/**
 * Data + derived state for `SystemMetricsPanel`, keeping the panel a pure
 * render. Polls the gateway for per-replica metrics and decides whether the
 * feed is currently "live".
 */
export function useSystemMetricsPanel() {
  const { instances, isLoading, isError, isFetching, error, dataUpdatedAt } = useMetrics();

  // We can't know per-replica freshness cheaply, so treat the panel as live
  // whenever a refresh succeeded recently and we aren't currently erroring.
  const recentlyUpdated = dataUpdatedAt > 0 && Date.now() - dataUpdatedAt < LIVE_WINDOW_MS;
  const live = recentlyUpdated && !isError;

  const errorMessage = isError
    ? getErrorMessage(error, 'Failed to load system metrics.')
    : null;

  return { instances, isLoading, isError, isFetching, live, errorMessage };
}
