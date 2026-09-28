'use client';

import { BatteryCharging, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PageTransition } from '@/components/layout/page-transition';
import { PassportList, PassportListSkeleton } from '@/components/passports/passport-list';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Card, EmptyState, ErrorState, PageHeader } from '@/components/ui/surface';
import { useIsAdmin, usePassports } from '@/lib/queries';

const PAGE_SIZE = 20;

export default function PassportsPage() {
  const [page, setPage] = useState(1);
  const isAdmin = useIsAdmin();
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = usePassports(page, PAGE_SIZE);

  return (
    <PageTransition>
      <PageHeader
        title="Battery passports"
        description={
          data
            ? `${data.total} ${data.total === 1 ? 'passport' : 'passports'}`
            : 'Digital passports for registered batteries'
        }
        actions={
          isAdmin && (
            <Button asChild>
              <Link href="/passports/new">
                <Plus />
                New passport
              </Link>
            </Button>
          )
        }
      />

      <Card className="overflow-hidden">
        {isLoading ? (
          <PassportListSkeleton rows={8} />
        ) : isError ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : data && data.items.length > 0 ? (
          <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
            <PassportList passports={data.items} isAdmin={isAdmin} />
            <Pagination
              page={page}
              limit={PAGE_SIZE}
              total={data.total}
              onPageChange={setPage}
              label="Passports"
            />
          </div>
        ) : (
          <EmptyState
            icon={<BatteryCharging />}
            title="No passports yet"
            description={
              isAdmin
                ? 'Battery passports you create will be listed here.'
                : 'Passports created by an administrator will appear here.'
            }
            action={
              isAdmin && (
                <Button asChild size="sm">
                  <Link href="/passports/new">
                    <Plus />
                    New passport
                  </Link>
                </Button>
              )
            }
          />
        )}
      </Card>
    </PageTransition>
  );
}
