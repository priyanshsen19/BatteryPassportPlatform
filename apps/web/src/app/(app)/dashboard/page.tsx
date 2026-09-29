'use client';

import { ArrowRight, BatteryCharging, Clock, FileText, Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageTransition } from '@/components/layout/page-transition';
import { PassportTile } from '@/components/passports/passport-card';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/surface';
import { useDocuments, useCan, usePassports, useSession } from '@/lib/queries';
import { formatDateTime, formatRelative } from '@/lib/utils';

interface StatCardProps {
  label: string;
  icon: ReactNode;
  value?: ReactNode;
  detail?: ReactNode;
  href?: string;
  loading: boolean;
}

function StatCard({ label, icon, value, detail, href, loading }: StatCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent-ink [&_svg]:size-4">
          {icon}
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p className="mt-2 truncate text-3xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      )}
      <p className="mt-1 h-4 truncate text-xs text-ink-subtle">{!loading && detail}</p>
    </>
  );

  const className = 'block h-full rounded-lg border border-line bg-surface px-5 py-4 shadow-card';
  return href ? (
    <Link
      href={href}
      className={`${className} transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised`}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export default function DashboardPage() {
  const { data: user } = useSession();
  const canCreate = useCan('passport:create');
  const passports = usePassports({ limit: 6, sort: 'createdAt', order: 'desc' });
  const documents = useDocuments({ limit: 1 });

  const latest = passports.data?.items[0];
  const newPassportButton = canCreate && (
    <Button asChild>
      <Link href="/passports/new">
        <Plus />
        New passport
      </Link>
    </Button>
  );

  return (
    <PageTransition>
      <PageHeader
        title="Dashboard"
        description={user ? `Welcome back, ${user.email}` : undefined}
        actions={newPassportButton}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Battery passports"
          icon={<BatteryCharging />}
          href="/passports"
          value={passports.data && <AnimatedNumber value={passports.data.total} />}
          detail="Registered in the platform"
          loading={passports.isLoading}
        />
        <StatCard
          label="Documents"
          icon={<FileText />}
          href="/documents"
          value={documents.data && <AnimatedNumber value={documents.data.total} />}
          detail="Stored privately in S3"
          loading={documents.isLoading}
        />
        <StatCard
          label="Latest passport"
          icon={<Clock />}
          href={latest ? `/passports/${latest.id}` : undefined}
          value={
            latest ? (
              <span className="font-mono text-xl">{latest.data.generalInformation.batteryIdentifier}</span>
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

      <section aria-labelledby="recent-heading" className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-heading" className="text-sm font-semibold text-ink">
            Recent passports
          </h2>
          <Link
            href="/passports"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-accent underline-offset-4 hover:underline"
          >
            View all
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        {passports.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : passports.isError ? (
          <Card>
            <ErrorState message={passports.error.message} onRetry={() => passports.refetch()} />
          </Card>
        ) : passports.data && passports.data.items.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {passports.data.items.map((passport, index) => (
              <PassportTile key={passport.id} passport={passport} index={index} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<BatteryCharging />}
              title="No passports yet"
              description={
                canCreate
                  ? 'Create the first battery passport to start tracking its lifecycle data.'
                  : 'Passports created by an administrator will appear here.'
              }
              action={newPassportButton}
            />
          </Card>
        )}
      </section>
    </PageTransition>
  );
}
