'use client';

import { ROLES, ROLE_DESCRIPTIONS, type ManagedUserDto, type Role } from '@bpp/shared/schemas';
import { Search, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { RequirePermission } from '@/components/auth/require-permission';
import { PageTransition } from '@/components/layout/page-transition';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/form-controls';
import { Pagination } from '@/components/ui/pagination';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/surface';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { ROLE_LABELS, RoleBadge } from '@/components/users/role-badge';
import { ApiError } from '@/lib/api-client';
import { useDebouncedValue } from '@/lib/hooks';
import { useSession, useUpdateUserRole, useUsers } from '@/lib/queries';
import { formatDate } from '@/lib/utils';

const PAGE_SIZE = 20;

function RoleLegend() {
  return (
    <Card className="mb-5 p-5">
      <h2 className="text-sm font-semibold text-ink">What each role can do</h2>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((role) => (
          <div key={role} className="rounded-md border border-line bg-subtle/40 p-3">
            <dt>
              <RoleBadge role={role} />
            </dt>
            <dd className="mt-2 text-xs leading-relaxed text-ink-muted">{ROLE_DESCRIPTIONS[role]}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function SignInMethods({ user }: { user: ManagedUserDto }) {
  return (
    <div className="flex flex-wrap gap-1">
      {user.signInMethods.map((method) => (
        <Badge key={method} tone="neutral">
          {method === 'google' ? 'Google' : 'Password'}
        </Badge>
      ))}
    </div>
  );
}

function RoleSelect({ user, isSelf }: { user: ManagedUserDto; isSelf: boolean }) {
  const updateRole = useUpdateUserRole();

  if (isSelf) {
    return (
      <span className="inline-flex items-center gap-2">
        <RoleBadge role={user.role} />
        <span className="text-xs text-ink-subtle">You</span>
      </span>
    );
  }

  const change = (role: Role) => {
    if (role === user.role) return;
    updateRole.mutate(
      { userId: user.id, role },
      {
        onSuccess: (updated) =>
          toast.success('Role updated', {
            description: `${updated.email} is now ${ROLE_LABELS[updated.role]}`,
          }),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update the role'),
      },
    );
  };

  return (
    <div className="w-40">
      <Select
        value={user.role}
        onChange={(e) => change(e.target.value as Role)}
        disabled={updateRole.isPending}
        aria-label={`Role for ${user.email}`}
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </Select>
    </div>
  );
}

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function UsersTable() {
  const { data: me } = useSession();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const q = useDebouncedValue(search.trim(), 300);
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useUsers({
    page,
    limit: PAGE_SIZE,
    q: q || undefined,
    role: role || undefined,
  });

  return (
    <Card className="overflow-hidden shadow-card">
      <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by email"
            aria-label="Search users by email"
            className="pl-9"
          />
        </div>
        <div className="sm:w-44">
          <Select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role | '');
              setPage(1);
            }}
            aria-label="Filter by role"
          >
            <option value="">All roles</option>
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading users">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<UsersRound />}
          title="No users found"
          description="Try a different email or role filter."
        />
      ) : (
        <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <div className="hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH>User</TH>
                  <TH>Sign-in</TH>
                  <TH>Joined</TH>
                  <TH>Role</TH>
                </TR>
              </THead>
              <TBody>
                {data.items.map((user) => (
                  <TR key={user.id} className="hover:bg-subtle/60">
                    <TD>
                      <span className="flex items-center gap-3">
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink"
                          aria-hidden
                        >
                          {initials(user.email)}
                        </span>
                        <span className="truncate font-medium">{user.email}</span>
                      </span>
                    </TD>
                    <TD>
                      <SignInMethods user={user} />
                    </TD>
                    <TD className="whitespace-nowrap text-ink-muted tabular-nums">
                      {formatDate(user.createdAt)}
                    </TD>
                    <TD>
                      <RoleSelect user={user} isSelf={user.id === me?.id} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          <ul className="divide-y divide-line md:hidden">
            {data.items.map((user) => (
              <li key={user.id} className="flex flex-col gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">{user.email}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <SignInMethods user={user} />
                    <span className="text-xs text-ink-subtle">Joined {formatDate(user.createdAt)}</span>
                  </div>
                </div>
                <RoleSelect user={user} isSelf={user.id === me?.id} />
              </li>
            ))}
          </ul>

          <Pagination page={page} limit={PAGE_SIZE} total={data.total} onPageChange={setPage} label="Users" />
        </div>
      )}
    </Card>
  );
}

export default function UsersPage() {
  return (
    <PageTransition>
      <PageHeader
        title="User roles"
        description="Everyone who registers starts as a user. Assign roles here; changes apply immediately."
      />
      <RequirePermission permission="user:manage" description="Only administrators can manage user roles.">
        <RoleLegend />
        <UsersTable />
      </RequirePermission>
    </PageTransition>
  );
}
