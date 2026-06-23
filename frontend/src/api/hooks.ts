import { useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import {
  ConsumptionEvent,
  ConsumptionResult,
  Customer,
  Metrics,
  Paginated,
  Product,
} from './types';

// Centralized query keys — changing a key here automatically invalidates
// the right cache entries everywhere.
export const queryKeys = {
  products: ['products'] as const,
  customers: (offset: number, limit: number) => ['customers', offset, limit] as const,
  customer: (id: string) => ['customers', id] as const,
  history: (id: string, offset: number, limit: number) =>
    ['customers', id, 'consumption', offset, limit] as const,
  metrics: ['metrics'] as const,
};

export const PAGE_SIZE = 20;

// Background poll interval for balance/history data. Invalidation already keeps
// the UI fresh after the user's OWN actions; polling additionally picks up
// changes made by other users or other backend instances without a manual
// refresh. React Query pauses polling while the tab is hidden.
export const POLL_INTERVAL_MS = 10_000;

// Poll on an interval, but stop once the query has errored. A failed resource
// (e.g. a deleted customer returning 404) shouldn't be re-requested forever.
const pollUnlessErrored = (query: { state: { status: string } }): number | false =>
  query.state.status === 'error' ? false : POLL_INTERVAL_MS;

export function useProducts() {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: () => api.get<Product[]>('/products'),
    staleTime: 5 * 60 * 1000, // products rarely change — no polling needed
  });
}

export function useCustomers(offset = 0, limit = PAGE_SIZE) {
  return useQuery({
    queryKey: queryKeys.customers(offset, limit),
    queryFn: () =>
      api.get<Paginated<Customer>>(`/customers?limit=${limit}&offset=${offset}`),
    // Keep balances fresh even when changes come from elsewhere.
    refetchInterval: pollUnlessErrored,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: queryKeys.customer(id),
    queryFn: () => api.get<Customer>(`/customers/${id}`),
    enabled: Boolean(id),
    refetchInterval: pollUnlessErrored,
  });
}

export function useConsumptionHistory(customerId: string, offset = 0, limit = PAGE_SIZE) {
  return useQuery({
    queryKey: queryKeys.history(customerId, offset, limit),
    queryFn: () =>
      api.get<Paginated<ConsumptionEvent>>(
        `/customers/${customerId}/consumption?limit=${limit}&offset=${offset}`,
      ),
    enabled: Boolean(customerId),
    refetchInterval: pollUnlessErrored,
  });
}

export function useCreditWallet(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amountCents: number) =>
      api.post<Customer>(`/customers/${customerId}/credit`, { amountCents }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.customer(customerId) });
      // Invalidate all pages of the customer list.
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export interface ConsumeInput {
  customerId: string;
  productId: string;
  quantity: number;
  /**
   * Idempotency key — generate once per user click so a network retry or
   * React Query automatic retry reuses the same key and never double-charges.
   */
  idempotencyKey: string;
}

export function useConsume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ idempotencyKey, ...input }: ConsumeInput) =>
      api.post<ConsumptionResult>('/consumption', input, {
        'Idempotency-Key': idempotencyKey,
      }),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.customer(variables.customerId) });
      // Invalidate all pages of the history for this customer.
      qc.invalidateQueries({ queryKey: ['customers', variables.customerId, 'consumption'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

// How often the live-proof panel refreshes, and how many probes it fires per
// refresh. Two backend replicas sit behind the nginx gateway (round-robin), so
// a single request only reveals one of them — a small burst lets us observe
// BOTH replicas in one refresh.
export const METRICS_POLL_INTERVAL_MS = 4_000;
const METRICS_PROBE_COUNT = 8;

/**
 * Fire a burst of `/metrics` requests and return the freshest snapshot seen
 * per replica (`instance`). Uses allSettled so a few transient failures (the
 * gateway may briefly 503) don't discard the replicas that did respond.
 */
async function probeMetrics(probes = METRICS_PROBE_COUNT): Promise<Metrics[]> {
  const results = await Promise.allSettled(
    Array.from({ length: probes }, () => api.get<Metrics>('/metrics')),
  );

  const byInstance = new Map<string, Metrics>();
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value?.instance) {
      // Last writer wins — keep the most recent snapshot for each replica.
      byInstance.set(r.value.instance, r.value);
    }
  }

  if (byInstance.size === 0) {
    // Every probe failed — surface the error so the query enters its error
    // state rather than silently rendering an empty panel.
    const rejected = results.find(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    throw rejected?.reason ?? new Error('Failed to load metrics');
  }

  return [...byInstance.values()];
}

export interface UseMetricsResult {
  /** Discovered replicas, sorted by instance id for stable card ordering. */
  instances: Metrics[];
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  error: unknown;
  /** ms timestamp of the last successful refresh (0 until first success). */
  dataUpdatedAt: number;
}

/**
 * Live multi-replica metrics for the "Live proof" panel. Polls `/metrics` in
 * bursts and accumulates replicas across refreshes, so a replica that briefly
 * drops out of one refresh keeps showing its last-known values instead of
 * vanishing from the UI.
 */
export function useMetrics(): UseMetricsResult {
  const query = useQuery({
    queryKey: queryKeys.metrics,
    queryFn: () => probeMetrics(),
    refetchInterval: METRICS_POLL_INTERVAL_MS,
    // Our burst already provides resilience; don't double-retry the whole set.
    retry: false,
    staleTime: 0,
  });

  // Persist every replica we've ever seen and update it in place. Merging by
  // instance id is idempotent, so it's safe even under StrictMode re-renders.
  const seenRef = useRef<Map<string, Metrics>>(new Map());
  const instances = useMemo(() => {
    if (query.data) {
      for (const m of query.data) seenRef.current.set(m.instance, m);
    }
    return [...seenRef.current.values()].sort((a, b) =>
      a.instance.localeCompare(b.instance),
    );
  }, [query.data]);

  return {
    instances,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    error: query.error,
    dataUpdatedAt: query.dataUpdatedAt,
  };
}
