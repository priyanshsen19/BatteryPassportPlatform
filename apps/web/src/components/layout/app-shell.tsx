'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BatteryCharging, FileText, LayoutDashboard, LogOut, Menu, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { CommandPaletteProvider, useCommandPalette } from '@/components/command/command-palette';
import { Button } from '@/components/ui/button';
import { overlayClass } from '@/components/ui/dialog';
import { authApi } from '@/lib/api-client';
import { useSession } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/passports', label: 'Passports', icon: BatteryCharging },
  { href: '/documents', label: 'Documents', icon: FileText },
];

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
              'relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-brand',
              active
                ? 'bg-sidebar-raised text-sidebar-ink'
                : 'text-sidebar-muted hover:bg-sidebar-raised/60 hover:text-sidebar-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-indicator"
                className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brand"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <Icon className={cn('size-4', active && 'text-brand')} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function initialsOf(email: string): string {
  return email.slice(0, 2).toUpperCase();
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
    return <div className="h-10 animate-pulse rounded-md bg-sidebar-raised" aria-hidden />;
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-ink"
        aria-hidden
      >
        {initialsOf(user.email)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-sidebar-ink" title={user.email}>
          {user.email}
        </p>
        <p className="text-xs text-sidebar-muted capitalize">{user.role}</p>
      </div>
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        aria-label="Sign out"
        title="Sign out"
        className="rounded-md p-2 text-sidebar-muted transition-colors hover:bg-sidebar-raised hover:text-sidebar-ink focus-visible:outline-brand disabled:opacity-50"
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" onClick={onNavigate} className="rounded-md focus-visible:outline-brand">
          <Logo tone="on-dark" size="md" />
        </Link>
      </div>
      <p className="px-5 pt-2 pb-2 text-[11px] font-medium tracking-wider text-sidebar-muted/80 uppercase">
        Battery passport
      </p>
      <div className="flex-1 px-3">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <div className="border-t border-sidebar-line p-4">
        <UserPanel />
      </div>
    </div>
  );
}

const subscribe = () => () => {};
/** Shows the platform-appropriate shortcut hint once running in the browser. */
function useShortcutLabel(): string {
  return useSyncExternalStore(
    subscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'),
    () => '⌘K',
  );
}

function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { open } = useCommandPalette();
  const shortcut = useShortcutLabel();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur sm:px-6 lg:px-10">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>
      <Link href="/dashboard" className="rounded-md lg:hidden">
        <Logo size="sm" />
      </Link>

      <button
        type="button"
        onClick={open}
        className="ml-auto flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-[13px] text-ink-subtle shadow-card transition-colors hover:border-line-strong hover:text-ink-muted sm:w-72 lg:ml-0"
        aria-label="Search passports and pages"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Search passports…</span>
        <kbd className="ml-auto hidden rounded border border-line bg-subtle px-1.5 py-0.5 font-mono text-[11px] sm:inline">
          {shortcut}
        </kbd>
      </button>

      <div className="flex items-center lg:ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <CommandPaletteProvider>
      <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>

        <aside className="sticky top-0 hidden h-dvh lg:block">
          <Sidebar />
        </aside>

        <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className={overlayClass} />
            <DialogPrimitive.Content asChild aria-describedby={undefined}>
              <motion.div
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-overlay focus:outline-none"
              >
                <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    className="absolute top-5 right-4 z-10 rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-raised hover:text-sidebar-ink"
                    aria-label="Close navigation"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </DialogPrimitive.Close>
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <div className="flex min-w-0 flex-col">
          <TopBar onOpenMenu={() => setMobileOpen(true)} />
          <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
