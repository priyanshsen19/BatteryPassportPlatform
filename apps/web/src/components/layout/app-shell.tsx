'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BatteryCharging, FileText, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/surface';
import { authApi } from '@/lib/api-client';
import { useSession } from '@/lib/queries';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/passports', label: 'Passports', icon: BatteryCharging },
  { href: '/documents', label: 'Documents', icon: FileText },
];

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 rounded-md">
      <span className="flex size-7 items-center justify-center rounded-md bg-accent text-white">
        <BatteryCharging className="size-4" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-[13px] font-semibold text-ink">Battery Passport</span>
        <span className="block text-[11px] text-ink-subtle">Platform</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
              active ? 'bg-accent-soft text-accent-ink' : 'text-ink-muted hover:bg-subtle hover:text-ink',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserPanel() {
  const { data: user, isLoading } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    await authApi.logout();
    queryClient.clear();
    router.replace('/login');
  };

  if (isLoading || !user) {
    return (
      <div className="space-y-2 p-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-16" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-ink" title={user.email}>
          {user.email}
        </p>
        <Badge tone={user.role === 'admin' ? 'accent' : 'neutral'} className="mt-1 capitalize">
          {user.role}
        </Badge>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={signOut}
        loading={signingOut}
        aria-label="Sign out"
        title="Sign out"
      >
        {!signingOut && <LogOut />}
      </Button>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <Brand />
      </div>
      <div className="flex-1 px-3">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <div className="border-t border-line p-4">
        <UserPanel />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
        <Brand />
        <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogPrimitive.Trigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation">
              <Menu />
            </Button>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/30" />
            <DialogPrimitive.Content asChild aria-describedby={undefined}>
              <motion.div
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-line bg-surface shadow-lg focus:outline-none"
              >
                <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
                <DialogPrimitive.Close asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-4 right-3"
                    aria-label="Close navigation"
                  >
                    <X />
                  </Button>
                </DialogPrimitive.Close>
                <SidebarContent onNavigate={() => setMobileOpen(false)} />
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </header>

      <main id="main" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
