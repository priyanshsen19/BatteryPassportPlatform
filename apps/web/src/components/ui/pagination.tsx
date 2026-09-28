import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  label: string;
}

export function Pagination({ page, limit, total, onPageChange, label }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav
      aria-label={`${label} pagination`}
      className="flex items-center justify-between gap-3 border-t border-line px-4 py-3"
    >
      <p className="text-xs text-ink-muted">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <span className="px-2 text-xs text-ink-muted tabular-nums">
          {page} / {pageCount}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
