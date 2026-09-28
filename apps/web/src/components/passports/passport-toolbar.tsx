'use client';

import { BATTERY_CATEGORIES, BATTERY_STATUSES } from '@bpp/shared/schemas';
import { LayoutGrid, Rows3, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Input, Select } from '@/components/ui/form-controls';
import { useDebouncedValue } from '@/lib/hooks';
import { cn } from '@/lib/utils';

export type PassportView = 'table' | 'cards';

interface PassportToolbarProps {
  q: string;
  category: string;
  status: string;
  view: PassportView;
  onChange: (patch: { q?: string; category?: string; status?: string; view?: PassportView }) => void;
}

function ViewToggle({ view, onChange }: { view: PassportView; onChange: (view: PassportView) => void }) {
  const options = [
    { value: 'table' as const, label: 'Table view', icon: Rows3 },
    { value: 'cards' as const, label: 'Card view', icon: LayoutGrid },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Layout"
      className="flex rounded-md border border-line-strong bg-surface p-0.5"
    >
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={view === value}
          aria-label={label}
          title={label}
          onClick={() => onChange(value)}
          className={cn(
            'flex size-8 items-center justify-center rounded transition-colors',
            view === value ? 'bg-accent-soft text-accent-ink' : 'text-ink-subtle hover:text-ink',
          )}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}

export function PassportToolbar({ q, category, status, view, onChange }: PassportToolbarProps) {
  const [search, setSearch] = useState(q);
  const debounced = useDebouncedValue(search, 300);

  useEffect(() => {
    if (debounced.trim() !== q) onChange({ q: debounced.trim() });
    // Only react to the user's typing; `q` changes as a consequence of this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Reflect changes made elsewhere (e.g. "Clear filters" or browser back) in the input.
  useEffect(() => {
    if (q !== search.trim() && q !== debounced.trim()) setSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = Boolean(q || category || status);

  return (
    <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search identifier, model or manufacturer"
          aria-label="Search passports"
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-[calc(50%-4px)] sm:w-36">
          <Select
            value={category}
            onChange={(e) => onChange({ category: e.target.value })}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {BATTERY_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-[calc(50%-4px)] sm:w-40">
          <Select
            value={status}
            onChange={(e) => onChange({ status: e.target.value })}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {BATTERY_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              onChange({ q: '', category: '', status: '' });
            }}
            className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-[13px] text-ink-muted hover:bg-subtle hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
            Clear
          </button>
        )}
        <div className="ml-auto sm:ml-0">
          <ViewToggle view={view} onChange={(next) => onChange({ view: next })} />
        </div>
      </div>
    </div>
  );
}
