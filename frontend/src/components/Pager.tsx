import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface PagerProps {
  currentPage: number;
  totalPages: number;
  onPage: (page: number) => void;
  size?: 'small' | 'medium';
  label?: string;
}

/**
 * Previous / Next pagination control.
 * Renders nothing when there is only one page.
 */
export function Pager({ currentPage, totalPages, onPage, size = 'medium', label }: PagerProps) {
  if (totalPages <= 1) return null;

  return (
    <Stack direction="row" justifyContent="center" alignItems="center" spacing={2} sx={{ p: size === 'small' ? 2 : 0 }}>
      <Button
        variant="outlined"
        size={size}
        disabled={currentPage <= 1}
        onClick={() => onPage(currentPage - 1)}
      >
        Previous
      </Button>
      <Typography variant="body2" color="text.secondary">
        {label ?? `Page ${currentPage} of ${totalPages}`}
      </Typography>
      <Button
        variant="outlined"
        size={size}
        disabled={currentPage >= totalPages}
        onClick={() => onPage(currentPage + 1)}
      >
        Next
      </Button>
    </Stack>
  );
}
