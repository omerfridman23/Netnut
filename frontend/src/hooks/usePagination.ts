import { useState } from 'react';
import { PAGE_SIZE } from '../api/hooks';

/**
 * Encapsulates offset/page state and the math shared by every paginated view.
 * Call `paginate(total)` after the API responds to get the derived page values.
 */
export function usePagination(pageSize = PAGE_SIZE) {
  const [offset, setOffset] = useState(0);

  const goToPage = (page: number) => setOffset((page - 1) * pageSize);

  const paginate = (total: number) => ({
    currentPage: Math.floor(offset / pageSize) + 1,
    totalPages: Math.ceil(total / pageSize),
  });

  return { offset, goToPage, paginate };
}
