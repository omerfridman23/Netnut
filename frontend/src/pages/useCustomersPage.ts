import { useMemo, useState } from 'react';
import { PAGE_SIZE, useCustomers } from '../api/hooks';
import { usePagination } from '../hooks/usePagination';

export function useCustomersPage() {
  const [search, setSearch] = useState('');
  const { offset, goToPage, paginate } = usePagination();

  const query = useCustomers(offset, PAGE_SIZE);
  const customers = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const { currentPage, totalPages } = paginate(total);

  const stats = useMemo(() => {
    const totalBalance = customers.reduce((sum, c) => sum + c.walletBalance, 0);
    return { count: total, totalBalance };
  }, [customers, total]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? customers.filter((c) => c.name.toLowerCase().includes(q)) : customers;
  }, [customers, search]);

  return {
    search,
    setSearch,
    customers: filtered,
    stats,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    currentPage,
    totalPages,
    total,
    goToPage,
  };
}
