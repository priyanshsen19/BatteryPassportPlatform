'use client';

import type { PassportDto, PassportSortField } from '@bpp/shared/schemas';
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/surface';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { useCan } from '@/lib/queries';
import { cn, formatDate } from '@/lib/utils';
import { CategoryBadge, StatusBadge } from './passport-badges';
import { DeletePassportDialog } from './delete-passport-dialog';

export interface SortState {
  sort: PassportSortField;
  order: 'asc' | 'desc';
  onSort: (field: PassportSortField) => void;
}

interface PassportListProps {
  passports: PassportDto[];
  compact?: boolean;
  sorting?: SortState;
}

const COLUMNS: { field: PassportSortField; label: string }[] = [
  { field: 'batteryIdentifier', label: 'Battery identifier' },
  { field: 'modelName', label: 'Battery model' },
  { field: 'batteryCategory', label: 'Category' },
  { field: 'batteryStatus', label: 'Status' },
  { field: 'manufacturerName', label: 'Manufacturer' },
  { field: 'manufacturingDate', label: 'Manufactured' },
];

function ColumnHeader({
  field,
  label,
  sorting,
}: {
  field: PassportSortField;
  label: string;
  sorting?: SortState;
}) {
  if (!sorting) return <TH>{label}</TH>;

  const active = sorting.sort === field;
  const Icon = !active ? ChevronsUpDown : sorting.order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TH aria-sort={active ? (sorting.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => sorting.onSort(field)}
        className={cn(
          '-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-line/60 hover:text-ink',
          active && 'text-ink',
        )}
      >
        {label}
        <Icon className={cn('size-3.5', !active && 'opacity-40')} aria-hidden />
      </button>
    </TH>
  );
}

/** Table on medium+ screens, stacked rows on small screens. */
export function PassportList({ passports, compact, sorting }: PassportListProps) {
  const router = useRouter();
  const canEdit = useCan('passport:update');
  const canDelete = useCan('passport:delete');
  const [toDelete, setToDelete] = useState<PassportDto | null>(null);
  const showActions = !compact;

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <THead>
            <TR>
              {COLUMNS.map((column) => (
                <ColumnHeader key={column.field} {...column} sorting={sorting} />
              ))}
              {showActions && (
                <TH className="text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              )}
            </TR>
          </THead>
          <TBody>
            {passports.map((passport) => {
              const info = passport.data.generalInformation;
              return (
                <TR
                  key={passport.id}
                  className="cursor-pointer hover:bg-subtle/60"
                  onClick={() => router.push(`/passports/${passport.id}`)}
                >
                  <TD>
                    <Link
                      href={`/passports/${passport.id}`}
                      className="font-mono text-[13px] font-medium text-ink hover:text-accent"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {info.batteryIdentifier}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{info.batteryModel.modelName}</TD>
                  <TD>
                    <CategoryBadge category={info.batteryCategory} />
                  </TD>
                  <TD>
                    <StatusBadge status={info.batteryStatus} />
                  </TD>
                  <TD className="text-ink-muted">{info.manufacturerInformation.manufacturerName}</TD>
                  <TD className="whitespace-nowrap text-ink-muted tabular-nums">
                    {formatDate(info.manufacturingDate)}
                  </TD>
                  {showActions && (
                    <TD className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {canEdit && (
                          <Button variant="ghost" size="icon-sm" asChild>
                            <Link
                              href={`/passports/${passport.id}/edit`}
                              aria-label={`Edit ${info.batteryIdentifier}`}
                            >
                              <Pencil />
                            </Link>
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="danger-ghost"
                            size="icon-sm"
                            aria-label={`Delete ${info.batteryIdentifier}`}
                            onClick={() => setToDelete(passport)}
                          >
                            <Trash2 />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link
                            href={`/passports/${passport.id}`}
                            aria-label={`View ${info.batteryIdentifier}`}
                          >
                            <ChevronRight />
                          </Link>
                        </Button>
                      </div>
                    </TD>
                  )}
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {passports.map((passport) => {
          const info = passport.data.generalInformation;
          return (
            <li key={passport.id}>
              <Link
                href={`/passports/${passport.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-subtle/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] font-medium text-ink">
                      {info.batteryIdentifier}
                    </span>
                    <StatusBadge status={info.batteryStatus} />
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-muted">
                    {info.batteryModel.modelName} · {info.batteryCategory} ·{' '}
                    {info.manufacturerInformation.manufacturerName}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>

      <DeletePassportDialog passport={toDelete} onOpenChange={(open) => !open && setToDelete(null)} />
    </>
  );
}

export function PassportListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy="true" aria-label="Loading passports">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="hidden h-4 w-24 md:block" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="hidden h-4 w-28 md:block" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
