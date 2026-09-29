'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageTransition } from '@/components/layout/page-transition';
import { RequirePermission } from '@/components/auth/require-permission';
import { PassportForm } from '@/components/passports/passport-form';
import { Card, ErrorState, PageHeader, Skeleton } from '@/components/ui/surface';
import { usePassport } from '@/lib/queries';

export default function EditPassportPage() {
  const { id } = useParams<{ id: string }>();
  const { data: passport, isLoading, isError, error, refetch } = usePassport(id);

  return (
    <PageTransition>
      <PageHeader
        eyebrow={
          <Link
            href={`/passports/${id}`}
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            {passport?.data.generalInformation.batteryIdentifier ?? 'Passport'}
          </Link>
        }
        title="Edit battery passport"
      />
      <RequirePermission
        permission="passport:update"
        description="Only administrators and developers can create or edit battery passports."
      >
        {isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : isError ? (
          <Card>
            <ErrorState message={error.message} onRetry={() => refetch()} />
          </Card>
        ) : (
          passport && <PassportForm passport={passport} />
        )}
      </RequirePermission>
    </PageTransition>
  );
}
