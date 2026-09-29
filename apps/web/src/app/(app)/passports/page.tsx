'use client';

import {
  BATTERY_CATEGORIES,
  BATTERY_STATUSES,
  PASSPORT_SORT_FIELDS,
  type BatteryCategory,
  type BatteryStatus,
  type PassportSortField,
} from '@bpp/shared/schemas';
import { BatteryCharging, Plus, SearchX } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback } from 'react';
import { PageTransition } from '@/components/layout/page-transition';
import { PassportTile } from '@/components/passports/passport-card';
import { PassportList, PassportListSkeleton } from '@/components/passports/passport-list';
import { PassportToolbar, type PassportView } from '@/components/passports/passport-toolbar';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/surface';
import { useCan, usePassports } from '@/lib/queries';

const PAGE_SIZE = 20;
const DATE_FIELDS: PassportSortField[] = ['createdAt', 'manufacturingDate'];

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | undefined =>
  allowed.includes(value as T) ? (value as T) : undefined;

/** Search, filters, sorting, page and layout live in the URL so views can be shared and restored. */
function usePassportListState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state = {
    q: params.get('q') ?? '',
    category: pick<BatteryCategory>(params.get('category'), BATTERY_CATEGORIES),
    status: pick<BatteryStatus>(params.get('status'), BATTERY_STATUSES),
    sort: pick<PassportSortField>(params.get('sort'), PASSPORT_SORT_FIELDS) ?? 'createdAt',
    order: params.get('order') === 'asc' ? ('asc' as const) : ('desc' as const),
    page: Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1),
    view: (params.get('view') === 'cards' ? 'cards' : 'table') as PassportView,
  };

  const update = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(params.toString());
      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      // Any change other than paging starts again from the first page.
      if (!('page' in patch)) next.delete('page');
      if (next.get('page') === '1') next.delete('page');
      if (next.get('view') === 'table') next.delete('view');
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return { state, update };
}

function PassportsContent() {
  const canCreate = useCan('passport:create');
  const { state, update } = usePassportListState();
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = usePassports({
    q: state.q || undefined,
    category: state.category,
    status: state.status,
    sort: state.sort,
    order: state.order,
    page: state.page,
    limit: PAGE_SIZE,
  });

  const onSort = (field: PassportSortField) => {
    if (field === state.sort) update({ order: state.order === 'asc' ? 'desc' : 'asc' });
    else update({ sort: field, order: DATE_FIELDS.includes(field) ? 'desc' : 'asc' });
  };

  const filtered = Boolean(state.q || state.category || state.status);
  const newPassportButton = canCreate && (
    <Button asChild>
      <Link href="/passports/new">
        <Plus />
        New passport
      </Link>
    </Button>
  );

  let body;
  if (isLoading) {
    body =
      state.view === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : (
        <PassportListSkeleton rows={8} />
      );
  } else if (isError) {
    body = <ErrorState message={error.message} onRetry={() => refetch()} />;
  } else if (!data || data.items.length === 0) {
    body = filtered ? (
      <EmptyState
        icon={<SearchX />}
        title="No passports match these filters"
        description="Try a different search term or clear the filters."
        action={
          <Button variant="secondary" size="sm" onClick={() => update({ q: '', category: '', status: '' })}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<BatteryCharging />}
        title="No passports yet"
        description={
          canCreate
            ? 'Battery passports you create will be listed here.'
            : 'Passports created by an administrator will appear here.'
        }
        action={newPassportButton}
      />
    );
  } else {
    body = (
      <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        {state.view === 'cards' ? (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((passport, index) => (
              <PassportTile key={passport.id} passport={passport} index={index} />
            ))}
          </div>
        ) : (
          <PassportList passports={data.items} sorting={{ sort: state.sort, order: state.order, onSort }} />
        )}
        <Pagination
          page={state.page}
          limit={PAGE_SIZE}
          total={data.total}
          onPageChange={(page) => update({ page })}
          label="Passports"
        />
      </div>
    );
  }

  return (
    <PageTransition>
      <PageHeader
        title="Battery passports"
        description={
          data
            ? `${data.total} ${data.total === 1 ? 'passport' : 'passports'}${filtered ? ' match your filters' : ''}`
            : 'Digital passports for registered batteries'
        }
        actions={newPassportButton}
      />
      <Card className="overflow-hidden shadow-card">
        <PassportToolbar
          q={state.q}
          category={state.category ?? ''}
          status={state.status ?? ''}
          view={state.view}
          onChange={update}
        />
        {body}
      </Card>
    </PageTransition>
  );
}

export default function PassportsPage() {
  return (
    <Suspense fallback={<PassportListSkeleton rows={8} />}>
      <PassportsContent />
    </Suspense>
  );
}
