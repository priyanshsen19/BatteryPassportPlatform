'use client';

import { ArrowRight, BatteryCharging, Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageTransition } from '@/components/layout/page-transition';
import { PassportList, PassportListSkeleton } from '@/components/passports/passport-list';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/surface';
import { useDocuments, useIsAdmin, usePassports, useSession } from '@/lib/queries';
import { formatDateTime, formatNumber, formatRelative } from '@/lib/utils';

function StatCard({
  label,
  value,
  detail,
  loading,
}: {
  label: string;
  value?: ReactNode;
  detail?: ReactNode;
  loading: boolean;
}) {
  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      )}
      <p className="mt-1 h-4 text-xs text-ink-subtle">{!loading && detail}</p>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: user } = useSession();
  const isAdmin = useIsAdmin();
  const passports = usePassports(1, 5);
  const documents = useDocuments({ limit: 1 });

  const latest = passports.data?.items[0];

  return (
    <PageTransition>
      <PageHeader
        title="Dashboard"
        description={user ? `Signed in as ${user.email}` : undefined}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Battery passports"
          value={passports.data && formatNumber(passports.data.total)}
          detail="Registered in the platform"
          loading={passports.isLoading}
        />
        <StatCard
          label="Documents"
          value={documents.data && formatNumber(documents.data.total)}
          detail="Stored in S3"
          loading={documents.isLoading}
        />
        <StatCard
          label="Latest passport"
          value={
            latest ? (
              <span className="font-mono text-lg">{latest.data.generalInformation.batteryIdentifier}</span>
            ) : (
              '—'
            )
          }
          detail={
            latest && (
              <time dateTime={latest.createdAt} title={formatDateTime(latest.createdAt)}>
                Added {formatRelative(latest.createdAt)}
              </time>
            )
          }
          loading={passports.isLoading}
        />
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Recent passports</h2>
          <Link
            href="/passports"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-accent underline-offset-4 hover:underline"
          >
            View all
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        {passports.isLoading ? (
          <PassportListSkeleton rows={5} />
        ) : passports.isError ? (
          <ErrorState message={passports.error.message} onRetry={() => passports.refetch()} />
        ) : passports.data && passports.data.items.length > 0 ? (
          <PassportList passports={passports.data.items} isAdmin={isAdmin} compact />
        ) : (
          <EmptyState
            icon={<BatteryCharging />}
            title="No passports yet"
            description={
              isAdmin
                ? 'Create the first battery passport to start tracking its lifecycle data.'
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
