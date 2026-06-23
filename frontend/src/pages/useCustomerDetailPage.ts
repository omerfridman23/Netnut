import { useMemo, useState } from 'react';
import { PAGE_SIZE, useConsumptionHistory, useCustomer } from '../api/hooks';
import { usePagination } from '../hooks/usePagination';
import { ApiError } from '../api/client';

export function useCustomerDetailPage(id: string) {
  const { offset, goToPage, paginate } = usePagination();
  const [consumeOpen, setConsumeOpen] = useState(false);

  const customerQuery = useCustomer(id);
  const history = useConsumptionHistory(id, offset, PAGE_SIZE);

  const events = history.data?.data ?? [];
  const total = history.data?.total ?? 0;
  const { currentPage, totalPages } = paginate(total);

  const metrics = useMemo(() => {
    const pageTotal = events.reduce((sum, e) => sum + e.totalCost, 0);
    return { pageTotal, count: total };
  }, [events, total]);

  // Interpret the load error once, here, so the view just renders a message.
  const err = customerQuery.error;
  const isNotFound = err instanceof ApiError && err.status === 404;
  const errorMessage = !customerQuery.isError
    ? null
    : isNotFound
      ? 'Customer not found.'
      : err instanceof ApiError
        ? err.message
        : 'Failed to load customer.';

  return {
    customer: customerQuery.data,
    isLoading: customerQuery.isLoading,
    isError: customerQuery.isError,
    isNotFound,
    errorMessage,
    history,
    events,
    metrics,
    currentPage,
    totalPages,
    goToPage,
    consumeOpen,
    openConsume: () => setConsumeOpen(true),
    closeConsume: () => setConsumeOpen(false),
  };
}
