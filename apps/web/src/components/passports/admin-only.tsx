'use client';

import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, EmptyState, Skeleton } from '@/components/ui/surface';
import { useSession } from '@/lib/queries';

/**
 * Hides admin-only screens from users. This is a UX affordance only: the services reject
 * the underlying requests with 403 regardless of what the UI shows.
 */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useSession();

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (user?.role !== 'admin') {
    return (
      <Card>
        <EmptyState
          icon={<ShieldAlert />}
          title="Admin access required"
          description="Only administrators can create or edit battery passports."
        />
      </Card>
    );
  }
  return <>{children}</>;
}
