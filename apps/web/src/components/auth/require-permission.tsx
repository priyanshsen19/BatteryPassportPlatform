'use client';

import type { Permission } from '@bpp/shared/schemas';
import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, EmptyState, Skeleton } from '@/components/ui/surface';
import { useCan, useSession } from '@/lib/queries';

interface RequirePermissionProps {
  permission: Permission;
  description: string;
  children: ReactNode;
}

/**
 * Hides screens a role cannot use. This is a UX affordance only: the services reject the
 * underlying requests with 403 regardless of what the UI shows.
 */
export function RequirePermission({ permission, description, children }: RequirePermissionProps) {
  const { isLoading } = useSession();
  const allowed = useCan(permission);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!allowed) {
    return (
      <Card>
        <EmptyState
          icon={<ShieldAlert />}
          title="You don't have access to this page"
          description={description}
        />
      </Card>
    );
  }
  return <>{children}</>;
}
